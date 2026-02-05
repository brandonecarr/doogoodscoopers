import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";
import { sendWelcomeEmail, sendNewCustomerNotificationEmail } from "@/lib/email";
import { getStripe } from "@/lib/stripe";
import { queueMarketingSync } from "@/lib/marketing-sync";

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

  // Referral & Gift Certificates
  referralCode?: string;
  giftCertificateCode?: string;
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

    // 7. Create Local Subscription
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

    // 7a. Create draft invoice for the new subscription
    if (subscription && pricePerVisitCents > 0) {
      try {
        // Generate invoice number - find the highest existing number and increment
        const { data: latestInvoices } = await supabase
          .from("invoices")
          .select("invoice_number")
          .eq("org_id", org.id)
          .like("invoice_number", "INV-%")
          .order("invoice_number", { ascending: false })
          .limit(1);

        const latestInvoice = latestInvoices?.[0] as { invoice_number: string } | undefined;
        let nextNumber = 1;
        if (latestInvoice?.invoice_number) {
          const match = latestInvoice.invoice_number.match(/INV-(\d+)/);
          if (match) {
            nextNumber = parseInt(match[1], 10) + 1;
          }
        }
        const invoiceNumber = `INV-${String(nextNumber).padStart(5, "0")}`;

        // Determine billing interval based on frequency
        const billingIntervalMap: Record<string, string> = {
          WEEKLY: "WEEKLY",
          BIWEEKLY: "BIWEEKLY",
          MONTHLY: "MONTHLY",
          ONETIME: "MONTHLY",
        };

        // Create draft invoice in local database
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("invoices").insert({
          org_id: org.id,
          client_id: client.id,
          subscription_id: subscription.id,
          invoice_number: invoiceNumber,
          status: "DRAFT",
          subtotal_cents: pricePerVisitCents,
          discount_cents: 0,
          tax_cents: 0,
          total_cents: pricePerVisitCents,
          amount_paid_cents: 0,
          amount_due_cents: pricePerVisitCents,
          tip_cents: 0,
          billing_option: "PREPAID_FIXED",
          billing_interval: billingIntervalMap[dbFrequency] || "MONTHLY",
          due_date: getNextServiceDate(),
          notes: `Auto-generated draft invoice for subscription`,
        });

        console.log(`Created draft invoice ${invoiceNumber} for subscription ${subscription.id}`);
      } catch (draftInvoiceError) {
        console.error("Failed to create draft invoice:", draftInvoiceError);
        // Don't fail the registration for invoice issues
      }
    }

    // 7b. Create Stripe Subscription for recurring billing
    let stripeSubscriptionId: string | null = null;
    if (subscription && pricePerVisitCents > 0 && dbFrequency !== "ONETIME") {
      try {
        const stripe = getStripe();

        // Map frequency to Stripe interval
        const intervalMap: Record<string, { interval: "week" | "month"; interval_count: number }> = {
          WEEKLY: { interval: "week", interval_count: 1 },
          BIWEEKLY: { interval: "week", interval_count: 2 },
          MONTHLY: { interval: "month", interval_count: 1 },
        };
        const { interval, interval_count } = intervalMap[dbFrequency] || intervalMap.WEEKLY;

        // Create product for this subscription
        const product = await stripe.products.create({
          name: `Pet Waste Removal - ${dbFrequency}`,
          metadata: {
            subscription_id: subscription.id,
            client_id: client.id,
            org_id: org.id,
          },
        });

        // Create price for the product
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: pricePerVisitCents,
          currency: "usd",
          recurring: {
            interval,
            interval_count,
          },
        });

        // Create the Stripe subscription
        const stripeSubscription = await stripe.subscriptions.create({
          customer: stripeCustomer.id,
          items: [{ price: price.id }],
          metadata: {
            subscription_id: subscription.id,
            client_id: client.id,
            org_id: org.id,
          },
          payment_behavior: "default_incomplete",
          payment_settings: {
            save_default_payment_method: "on_subscription",
          },
          expand: ["latest_invoice.payment_intent"],
        });

        stripeSubscriptionId = stripeSubscription.id;

        // Update local subscription with Stripe subscription ID
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("subscriptions")
          .update({ stripe_subscription_id: stripeSubscriptionId })
          .eq("id", subscription.id);

        console.log(`Created Stripe subscription ${stripeSubscriptionId} for client ${client.id}`);
      } catch (stripeSubError) {
        console.error("Failed to create Stripe subscription:", stripeSubError);
        // Don't fail the registration - we can create the subscription later
      }
    }

    // 7c. Create invoice for initial cleanup fee if required
    let initialCleanupInvoiceId: string | null = null;
    const initialCleanupCents = Math.round(
      (data.pricingSnapshot?.initialCleanupFee || 0) * 100
    );

    if (data.initialCleanupRequired && initialCleanupCents > 0) {
      try {
        const stripe = getStripe();

        // Create invoice item for initial cleanup
        await stripe.invoiceItems.create({
          customer: stripeCustomer.id,
          amount: initialCleanupCents,
          currency: "usd",
          description: "Initial Yard Cleanup - One-time fee for first-time deep cleaning",
        });

        // Create the invoice (draft, not auto-charged)
        const invoice = await stripe.invoices.create({
          customer: stripeCustomer.id,
          collection_method: "send_invoice",
          days_until_due: 7,
          auto_advance: true, // Automatically finalize when due
          metadata: {
            type: "initial_cleanup",
            client_id: client.id,
            org_id: org.id,
          },
        });

        // Finalize the invoice so it can be paid
        await stripe.invoices.finalizeInvoice(invoice.id);

        initialCleanupInvoiceId = invoice.id;

        // Generate invoice number for initial cleanup
        const { data: latestCleanupInvoices } = await supabase
          .from("invoices")
          .select("invoice_number")
          .eq("org_id", org.id)
          .like("invoice_number", "INV-%")
          .order("invoice_number", { ascending: false })
          .limit(1);

        const latestCleanupInvoice = latestCleanupInvoices?.[0] as { invoice_number: string } | undefined;
        let nextCleanupNumber = 1;
        if (latestCleanupInvoice?.invoice_number) {
          const match = latestCleanupInvoice.invoice_number.match(/INV-(\d+)/);
          if (match) {
            nextCleanupNumber = parseInt(match[1], 10) + 1;
          }
        }
        const cleanupInvoiceNumber = `INV-${String(nextCleanupNumber).padStart(5, "0")}`;

        // Create local invoice record
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("invoices").insert({
          org_id: org.id,
          client_id: client.id,
          stripe_invoice_id: invoice.id,
          invoice_number: cleanupInvoiceNumber,
          status: "OPEN",
          subtotal_cents: initialCleanupCents,
          discount_cents: 0,
          tax_cents: 0,
          total_cents: initialCleanupCents,
          amount_paid_cents: 0,
          amount_due_cents: initialCleanupCents,
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          notes: "Initial yard cleanup fee",
        });

        console.log(`Created initial cleanup invoice ${invoice.id} for $${(initialCleanupCents / 100).toFixed(2)}`);
      } catch (invoiceError) {
        console.error("Failed to create initial cleanup invoice:", invoiceError);
        // Don't fail registration - invoice can be created manually
      }
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

    // 9. Handle referral code if provided
    let referralApplied = false;
    if (data.referralCode) {
      try {
        // Find the referrer by their referral code
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: referrer } = await (supabase as any)
          .from("clients")
          .select("id, first_name, last_name")
          .eq("org_id", org.id)
          .eq("referral_code", data.referralCode.toUpperCase())
          .single() as { data: { id: string; first_name: string; last_name: string } | null; error: Error | null };

        if (referrer) {
          // Get referral program settings
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: referralSettings } = await (supabase as any)
            .from("referral_program_settings")
            .select("is_enabled, reward_referrer_cents, reward_referee_cents, reward_type")
            .eq("org_id", org.id)
            .single();

          const autoIssueRewards = referralSettings?.is_enabled &&
            (referralSettings?.reward_referrer_cents > 0 || referralSettings?.reward_referee_cents > 0);

          // Create referral record
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: referralRecord } = await (supabase as any).from("referrals").insert({
            org_id: org.id,
            referrer_client_id: referrer.id,
            converted_client_id: client.id,
            referrer_name: `${referrer.first_name} ${referrer.last_name}`,
            referee_name: `${data.firstName} ${data.lastName}`,
            referee_email: data.email,
            referee_phone: data.phone || null,
            referral_code: data.referralCode.toUpperCase(),
            status: autoIssueRewards ? "REWARDED" : "CONVERTED",
            converted_at: new Date().toISOString(),
          }).select().single();

          // Auto-issue rewards if program is enabled
          if (autoIssueRewards && referralRecord) {
            const rewardType = referralSettings.reward_type || "ACCOUNT_CREDIT";

            // Issue referrer reward
            if (referralSettings.reward_referrer_cents > 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase as any).from("referral_rewards").insert({
                org_id: org.id,
                referral_id: referralRecord.id,
                client_id: referrer.id,
                amount_cents: referralSettings.reward_referrer_cents,
                reward_type: rewardType,
                issued_at: new Date().toISOString(),
              });

              // Add account credit for referrer
              if (rewardType === "ACCOUNT_CREDIT") {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase as any).from("account_credits").insert({
                  org_id: org.id,
                  client_id: referrer.id,
                  amount_cents: referralSettings.reward_referrer_cents,
                  balance_cents: referralSettings.reward_referrer_cents,
                  source: "REFERRAL",
                  reference_id: referralRecord.id,
                });
              }
            }

            // Issue referee reward
            if (referralSettings.reward_referee_cents > 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase as any).from("referral_rewards").insert({
                org_id: org.id,
                referral_id: referralRecord.id,
                client_id: client.id,
                amount_cents: referralSettings.reward_referee_cents,
                reward_type: rewardType,
                issued_at: new Date().toISOString(),
              });

              // Add account credit for referee (new customer)
              if (rewardType === "ACCOUNT_CREDIT") {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase as any).from("account_credits").insert({
                  org_id: org.id,
                  client_id: client.id,
                  amount_cents: referralSettings.reward_referee_cents,
                  balance_cents: referralSettings.reward_referee_cents,
                  source: "REFERRAL",
                  reference_id: referralRecord.id,
                });
              }
            }

            console.log(`Referral rewards issued: referrer ${referrer.id} and referee ${client.id}`);
          }

          referralApplied = true;
          console.log(`Referral tracked: ${referrer.first_name} ${referrer.last_name} referred ${data.firstName} ${data.lastName}`);
        }
      } catch (referralError) {
        console.error("Error processing referral:", referralError);
        // Don't fail the registration for referral issues
      }
    }

    // 10. Handle gift certificate if provided
    let giftCertificateApplied = false;
    let giftCertificateAmount = 0;
    if (data.giftCertificateCode) {
      try {
        // Find and validate the gift certificate
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: giftCert } = await (supabase as any)
          .from("gift_certificates")
          .select("id, code, amount_cents, balance_cents, status, expires_at")
          .eq("org_id", org.id)
          .eq("code", data.giftCertificateCode.toUpperCase())
          .eq("status", "ACTIVE")
          .single() as { data: { id: string; code: string; amount_cents: number; balance_cents: number; status: string; expires_at: string | null } | null; error: Error | null };

        if (giftCert && giftCert.balance_cents > 0) {
          // Check if expired
          const isExpired = giftCert.expires_at && new Date(giftCert.expires_at) < new Date();

          if (!isExpired) {
            // Apply as account credit
            const creditAmount = giftCert.balance_cents;

            // Create account credit for the client
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from("account_credits").insert({
              org_id: org.id,
              client_id: client.id,
              amount_cents: creditAmount,
              balance_cents: creditAmount,
              source: "GIFT_CERTIFICATE",
              reference_id: giftCert.id,
              notes: `Applied from gift certificate ${giftCert.code}`,
            });

            // Record the redemption
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from("gift_certificate_redemptions").insert({
              org_id: org.id,
              gift_certificate_id: giftCert.id,
              client_id: client.id,
              amount_cents: creditAmount,
            });

            // Update gift certificate balance
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from("gift_certificates")
              .update({
                balance_cents: 0,
                status: "REDEEMED",
                updated_at: new Date().toISOString(),
              })
              .eq("id", giftCert.id);

            giftCertificateApplied = true;
            giftCertificateAmount = creditAmount / 100;
            console.log(`Gift certificate ${giftCert.code} applied: $${giftCertificateAmount}`);
          }
        }
      } catch (giftCertError) {
        console.error("Error processing gift certificate:", giftCertError);
        // Don't fail the registration for gift certificate issues
      }
    }

    // 11. Update onboarding session if provided
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
          referralApplied,
          giftCertificateApplied,
          giftCertificateAmount,
        },
      });
    }

    // 12. Send welcome emails (non-blocking)
    const nextServiceDate = getNextServiceDate();
    const frequencyLabel = getFrequencyLabel(data.frequency);

    // Send welcome email to customer
    sendWelcomeEmail({
      customerName: data.firstName,
      email: data.email,
      frequency: frequencyLabel,
      numberOfDogs: data.numberOfDogs,
      address: data.address,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      nextServiceDate,
      recurringPrice: data.pricingSnapshot?.recurringPrice,
    }).catch((err) => console.error("Failed to send welcome email:", err));

    // Send notification to business owner
    sendNewCustomerNotificationEmail({
      customerName: `${data.firstName} ${data.lastName}`,
      email: data.email,
      frequency: frequencyLabel,
      numberOfDogs: data.numberOfDogs,
      address: data.address,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      nextServiceDate,
      recurringPrice: data.pricingSnapshot?.recurringPrice,
    }).catch((err) => console.error("Failed to send notification email:", err));

    // 13. Queue marketing sync for new signup (non-blocking)
    const isOnetimeSignup = dbFrequency === "ONETIME";
    queueMarketingSync({
      orgId: org.id,
      eventType: isOnetimeSignup ? "ONETIME_SIGNUP" : "RECURRING_SIGNUP",
      contact: {
        email: data.email,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        address: {
          line1: data.address,
          city: data.city,
          state: data.state,
          zip: data.zipCode,
        },
        dogCount: parseInt(data.numberOfDogs) || 1,
        frequency: frequencyLabel,
        subscriptionValue: data.pricingSnapshot?.recurringPrice,
      },
      tags: [
        isOnetimeSignup ? "one-time" : "recurring",
        `frequency-${dbFrequency.toLowerCase()}`,
        referralApplied ? "referred" : "organic",
      ],
    }).catch((err) => console.error("Failed to queue marketing sync:", err));

    return NextResponse.json({
      success: true,
      message: "Welcome to DooGoodScoopers! Your service registration is complete.",
      data: {
        clientId: client.id,
        subscriptionId: subscription?.id,
        stripeCustomerId: stripeCustomer.id,
        stripeSubscriptionId: stripeSubscriptionId || undefined,
        initialCleanupInvoiceId: initialCleanupInvoiceId || undefined,
        initialCleanupAmount: initialCleanupInvoiceId ? initialCleanupCents / 100 : undefined,
        referralApplied,
        giftCertificateApplied,
        giftCertificateAmount: giftCertificateApplied ? giftCertificateAmount : undefined,
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

// Helper to get human-readable frequency label
function getFrequencyLabel(frequency: string): string {
  const labels: Record<string, string> = {
    once_a_week: "Weekly",
    two_times_a_week: "Twice Weekly",
    weekly: "Weekly",
    bi_weekly: "Bi-Weekly",
    biweekly: "Bi-Weekly",
    once_a_month: "Monthly",
    monthly: "Monthly",
    one_time: "One-Time",
    onetime: "One-Time",
  };
  return labels[frequency.toLowerCase()] || frequency;
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
