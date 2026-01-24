import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

// Lazy Stripe initialization
let stripeInstance: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
      apiVersion: "2025-12-15.clover",
    });
  }
  return stripeInstance;
}

interface DogInfo {
  name: string;
  breed?: string;
  safe_dog?: boolean | string;
  comments?: string;
}

interface QuoteSubmission {
  // Session tracking
  sessionId?: string;

  // Service details
  zipCode: string;
  numberOfDogs: string;
  frequency: string;
  lastCleaned?: string;

  // Contact info
  firstName: string;
  lastName: string;
  email: string;
  phone: string;

  // Address
  address: string;
  city: string;
  state: string;
  gateLocation?: string;
  gateCode?: string;

  // Dog info
  dogs?: DogInfo[];

  // Notification preferences
  cleanupNotificationType?: string[];
  cleanupNotificationChannel?: string;

  // Flags
  inServiceArea: boolean;
  initialCleanupRequired?: boolean;

  // Payment info
  creditCardToken?: string;
  nameOnCard?: string;
  termsAccepted?: boolean;

  // Pricing
  pricingSnapshot?: {
    recurringPrice?: number;
    initialCleanupFee?: number;
    monthlyPrice?: number;
  };

  // Cross-sells (add-ons)
  crossSells?: string[];
}

// Map frontend frequency to database frequency
const frequencyMap: Record<string, string> = {
  once_a_week: "WEEKLY",
  two_times_a_week: "WEEKLY",
  weekly: "WEEKLY",
  bi_weekly: "BIWEEKLY",
  biweekly: "BIWEEKLY",
  once_a_month: "MONTHLY",
  monthly: "MONTHLY",
  one_time: "ONETIME",
  onetime: "ONETIME",
};

export async function POST(request: NextRequest) {
  try {
    const body: QuoteSubmission = await request.json();

    // Validate required fields
    const requiredFields = ["zipCode", "firstName", "lastName", "email", "phone"];
    const missingFields = requiredFields.filter(
      (field) => !body[field as keyof QuoteSubmission]
    );

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    // Route based on service area status
    if (body.inServiceArea) {
      return await submitInServiceAreaQuote(body);
    } else {
      return await submitOutOfServiceAreaLead(body);
    }
  } catch (error) {
    console.error("Error submitting quote:", error);
    return NextResponse.json(
      { error: "An error occurred while submitting your request" },
      { status: 500 }
    );
  }
}

async function submitInServiceAreaQuote(data: QuoteSubmission) {
  const supabase = await createClient();

  // Validate payment info
  if (!data.creditCardToken || !data.nameOnCard) {
    return NextResponse.json(
      { error: "Payment information is required to complete registration." },
      { status: 400 }
    );
  }

  if (!data.termsAccepted) {
    return NextResponse.json(
      { error: "Please accept the terms of service to continue." },
      { status: 400 }
    );
  }

  // Get organization
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "doogoodscoopers")
    .single<{ id: string }>();

  if (orgError || !org) {
    console.error("Failed to get organization:", orgError);
    return NextResponse.json(
      { error: "Service configuration error" },
      { status: 500 }
    );
  }

  try {
    // 1. Create Stripe Customer
    let stripeCustomer: Stripe.Customer;
    try {
      stripeCustomer = await getStripe().customers.create({
        email: data.email,
        name: `${data.firstName} ${data.lastName}`,
        phone: data.phone,
        address: {
          line1: data.address,
          city: data.city,
          state: data.state || "CA",
          postal_code: data.zipCode,
          country: "US",
        },
        metadata: {
          source: "website_quote_form",
          org_id: org.id,
        },
      });
    } catch (stripeError) {
      console.error("Failed to create Stripe customer:", stripeError);
      return NextResponse.json(
        { error: "Failed to process payment information." },
        { status: 500 }
      );
    }

    // 2. Attach payment method to customer
    try {
      await getStripe().customers.createSource(stripeCustomer.id, {
        source: data.creditCardToken,
      });
    } catch (stripeError) {
      console.error("Failed to attach payment method:", stripeError);
      // Clean up created customer
      await getStripe().customers.del(stripeCustomer.id);
      return NextResponse.json(
        { error: "Failed to process your card. Please check your card details and try again." },
        { status: 400 }
      );
    }

    // 3. Create Client in local database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: client, error: clientError } = await (supabase as any)
      .from("clients")
      .insert({
        org_id: org.id,
        stripe_customer_id: stripeCustomer.id,
        client_type: "RESIDENTIAL",
        status: "ACTIVE",
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone,
        referral_source: "website",
        notification_preferences: {
          sms: data.cleanupNotificationChannel === "sms",
          email: data.cleanupNotificationChannel === "email",
          types: data.cleanupNotificationType || ["completed"],
        },
      })
      .select("id")
      .single() as { data: { id: string } | null; error: Error | null };

    if (clientError || !client) {
      console.error("Failed to create client:", clientError);
      // Clean up Stripe customer
      await getStripe().customers.del(stripeCustomer.id);
      return NextResponse.json(
        { error: "Failed to create your account." },
        { status: 500 }
      );
    }

    // 4. Create Location
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: location, error: locationError } = await (supabase as any)
      .from("locations")
      .insert({
        org_id: org.id,
        client_id: client.id,
        address_line1: data.address,
        city: data.city,
        state: data.state || "CA",
        zip_code: data.zipCode,
        gate_code: data.gateCode,
        gate_location: data.gateLocation,
        is_primary: true,
        is_active: true,
      })
      .select("id")
      .single() as { data: { id: string } | null; error: Error | null };

    if (locationError || !location) {
      console.error("Failed to create location:", locationError);
      return NextResponse.json(
        { error: "Failed to save your address." },
        { status: 500 }
      );
    }

    // 5. Create Dogs
    if (data.dogs && data.dogs.length > 0) {
      const dogsToInsert = data.dogs.map((dog) => ({
        org_id: org.id,
        client_id: client.id,
        location_id: location.id,
        name: dog.name || "Unknown",
        breed: dog.breed || null,
        is_safe: dog.safe_dog === true || dog.safe_dog === "yes",
        special_instructions: dog.comments || null,
        is_active: true,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: dogsError } = await (supabase as any)
        .from("dogs")
        .insert(dogsToInsert);

      if (dogsError) {
        console.error("Failed to create dogs:", dogsError);
        // Don't fail the whole submission for dog creation issues
      }
    }

    // 6. Get the appropriate service plan
    const dbFrequency = frequencyMap[data.frequency.toLowerCase()] || "WEEKLY";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: plan } = await (supabase as any)
      .from("service_plans")
      .select("id")
      .eq("org_id", org.id)
      .eq("frequency", dbFrequency)
      .eq("is_active", true)
      .single() as { data: { id: string } | null; error: Error | null };

    // 7. Create Subscription
    const pricePerVisitCents = Math.round(
      (data.pricingSnapshot?.recurringPrice || 0) * 100
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: subscription, error: subscriptionError } = await (supabase as any)
      .from("subscriptions")
      .insert({
        org_id: org.id,
        client_id: client.id,
        location_id: location.id,
        plan_id: plan?.id,
        status: "ACTIVE",
        frequency: dbFrequency,
        price_per_visit_cents: pricePerVisitCents,
        next_service_date: getNextServiceDate(),
      })
      .select("id")
      .single() as { data: { id: string } | null; error: Error | null };

    if (subscriptionError) {
      console.error("Failed to create subscription:", subscriptionError);
      // Don't fail - subscription can be created later
    }

    // 8. Create subscription add-ons if any
    if (data.crossSells && data.crossSells.length > 0 && subscription) {
      for (const addOnId of data.crossSells) {
        // Get add-on details
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: addOn } = await (supabase as any)
          .from("add_ons")
          .select("id, price_cents")
          .eq("id", addOnId)
          .single() as { data: { id: string; price_cents: number } | null; error: Error | null };

        if (addOn) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("subscription_add_ons").insert({
            org_id: org.id,
            subscription_id: subscription.id,
            add_on_id: addOn.id,
            quantity: 1,
            price_cents: addOn.price_cents,
          });
        }
      }
    }

    // 9. Update onboarding session if provided
    if (data.sessionId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("onboarding_sessions")
        .update({
          status: "COMPLETED",
          converted_client_id: client.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.sessionId);

      // Log completion event
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("onboarding_events").insert({
        org_id: org.id,
        session_id: data.sessionId,
        event_type: "SUBMISSION_COMPLETED",
        step: "success",
        payload: {
          clientId: client.id,
          subscriptionId: subscription?.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Welcome to DooGoodScoopers! Your service registration is complete.",
      data: {
        clientId: client.id,
        subscriptionId: subscription?.id,
        stripeCustomerId: stripeCustomer.id,
      },
    });
  } catch (error) {
    console.error("Error in submitInServiceAreaQuote:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

async function submitOutOfServiceAreaLead(data: QuoteSubmission) {
  const supabase = await createClient();

  // Get organization
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "doogoodscoopers")
    .single<{ id: string }>();

  if (org) {
    // Store as unified lead
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("leads").insert({
      org_id: org.id,
      source: "OUT_OF_AREA",
      status: "NEW",
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone,
      zip_code: data.zipCode,
      city: data.city,
      state: data.state,
      address: {
        street: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
      },
      dog_count: parseInt(data.numberOfDogs) || 1,
      frequency: data.frequency,
    });

    // Update onboarding session if provided
    if (data.sessionId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("onboarding_sessions")
        .update({
          status: "COMPLETED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.sessionId);
    }
  }

  return NextResponse.json({
    success: true,
    message:
      "Thank you for your interest! We've added you to our waiting list and will notify you when we expand to your area.",
  });
}

// Helper to get next service date (next weekday)
function getNextServiceDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1); // Start from tomorrow

  // Find next weekday
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }

  return date.toISOString().split("T")[0];
}
