import { NextRequest, NextResponse } from "next/server";

const SWEEPANDGO_API_URL = process.env.SWEEPANDGO_API_URL || "https://openapi.sweepandgo.com";
const SWEEPANDGO_TOKEN = process.env.SWEEPANDGO_TOKEN;
const SWEEPANDGO_ORG_SLUG = process.env.SWEEPANDGO_ORG_SLUG || "doogoodscoopers";

interface QuoteSubmission {
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

  // Dog info (optional)
  dogNames?: string[];
  dogBreeds?: string[];
  safeDogs?: boolean[];

  // Flags
  inServiceArea: boolean;
  initialCleanupRequired?: boolean;

  // Payment info (required for in-service-area submissions)
  creditCardToken?: string;
  nameOnCard?: string;
  expiry?: string; // MMYY format for card expiration
  termsAccepted?: boolean;
  billingInterval?: string;
  category?: string;

  // Cross-sells (add-ons)
  crossSells?: number[];
}

export async function POST(request: NextRequest) {
  try {
    const body: QuoteSubmission = await request.json();

    // Validate required fields
    const requiredFields = ["zipCode", "firstName", "lastName", "email", "phone"];
    const missingFields = requiredFields.filter((field) => !body[field as keyof QuoteSubmission]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    if (!SWEEPANDGO_TOKEN) {
      console.error("SWEEPANDGO_TOKEN is not configured");
      return NextResponse.json(
        { error: "Service configuration error" },
        { status: 500 }
      );
    }

    // Route to different endpoints based on service area status
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
  // Validate payment info is present
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

  // Try v2 API first - create_client_with_package may have better Stripe support
  const v2Payload: Record<string, unknown> = {
    organization: SWEEPANDGO_ORG_SLUG,
    email: data.email,
    first_name: data.firstName,
    last_name: data.lastName,
    cell_phone_number: data.phone,
    home_address: data.address,
    city: data.city,
    state: data.state || "CA",
    zip_code: data.zipCode,
    number_of_dogs: parseInt(data.numberOfDogs) || 1,
    clean_up_frequency: data.frequency,
    last_time_yard_was_thoroughly_cleaned: data.lastCleaned || "two_weeks",
    initial_cleanup_required: data.initialCleanupRequired ? "1" : "0",
    // Payment fields - try both field name variations
    payment_method: "credit_card",
    credit_card_token: data.creditCardToken,
    token: data.creditCardToken, // Alternative field name
    name_on_card: data.nameOnCard,
    expiry: data.expiry,
    postal: data.zipCode,
    terms_open_api: true,
    // Dog info
    dog_name: data.dogNames || [],
    dog_breed: data.dogBreeds || [],
    safe_dog: data.safeDogs || [],
  };

  // Cross-sells
  if (data.crossSells && data.crossSells.length > 0) {
    v2Payload.cross_sells = data.crossSells.map(String);
    v2Payload.cross_sell_id = data.crossSells.map(String);
  }

  console.log("Submitting to v2 create_client_with_package:", JSON.stringify(v2Payload, null, 2));
  console.log("Token being sent:", data.creditCardToken);

  // Try v2 endpoint first
  let response = await fetch(
    `${SWEEPANDGO_API_URL}/api/v2/client_on_boarding/create_client_with_package`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SWEEPANDGO_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(v2Payload),
    }
  );

  console.log("Sweep&Go v2 API status:", response.status);

  // If v2 fails with 422 (validation error on cross_sell_id), fall back to v1
  if (response.status === 422) {
    console.log("v2 returned 422, falling back to v1 residential onboarding");

    const v1Payload: Record<string, unknown> = {
      organization: SWEEPANDGO_ORG_SLUG,
      email: data.email,
      first_name: data.firstName,
      last_name: data.lastName,
      cell_phone_number: data.phone,
      home_address: data.address,
      city: data.city,
      state: data.state || "CA",
      zip_code: data.zipCode,
      number_of_dogs: parseInt(data.numberOfDogs) || 1,
      clean_up_frequency: data.frequency,
      last_time_yard_was_thoroughly_cleaned: data.lastCleaned || "two_weeks",
      initial_cleanup_required: data.initialCleanupRequired ? "1" : "0",
      // Payment fields
      payment_method: "credit_card",
      credit_card_token: data.creditCardToken,
      name_on_card: data.nameOnCard,
      expiry: data.expiry,
      postal: data.zipCode,
      terms_open_api: true,
      dog_name: data.dogNames || [],
      dog_breed: data.dogBreeds || [],
      safe_dog: data.safeDogs || [],
    };

    if (data.crossSells && data.crossSells.length > 0) {
      v1Payload.cross_sells = data.crossSells.map(String);
    }

    console.log("Submitting to v1 residential onboarding:", JSON.stringify(v1Payload, null, 2));

    response = await fetch(
      `${SWEEPANDGO_API_URL}/api/v1/residential/onboarding`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${SWEEPANDGO_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(v1Payload),
      }
    );

    console.log("Sweep&Go v1 onboarding status:", response.status);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sweep&Go onboarding error:", response.status, errorText);

    let errorMessage = "Unable to complete your registration. Please try again or call us directly.";
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error) {
        errorMessage = errorJson.error;
      } else if (errorJson.message) {
        errorMessage = errorJson.message;
      } else if (errorJson.errors && Array.isArray(errorJson.errors)) {
        errorMessage = errorJson.errors.join(", ");
      }
    } catch {
      // Keep default error message
    }

    return NextResponse.json(
      { error: errorMessage, debug: { status: response.status, error: errorText } },
      { status: 500 }
    );
  }

  const result = await response.json();
  console.log("Sweep&Go onboarding response:", JSON.stringify(result, null, 2));

  // Log payment-related fields from response
  console.log("Payment info in response:", {
    has_credit_card: result.has_credit_card,
    payment_method: result.payment_method,
    billing: result.billing,
    credit_card: result.credit_card,
  });

  return NextResponse.json({
    success: true,
    message: "Welcome to DooGoodScoopers! Your service registration is complete.",
    data: result,
  });
}

async function submitOutOfServiceAreaLead(data: QuoteSubmission) {
  // Submit to out_of_service_form endpoint to capture lead
  const payload = {
    first_name: data.firstName,
    last_name: data.lastName,
    email: data.email,
    phone: data.phone,
    zip_code: data.zipCode,
    home_address: data.address || "",
    city: data.city || "",
    state: data.state || "CA",
  };

  const response = await fetch(
    `${SWEEPANDGO_API_URL}/api/v2/client_on_boarding/out_of_service_form`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SWEEPANDGO_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sweep&Go out-of-service error:", response.status, errorText);
    // Still return success to user - we don't want them to feel rejected
    return NextResponse.json({
      success: true,
      message: "Thank you for your interest! We've added you to our waiting list and will notify you when we expand to your area.",
    });
  }

  return NextResponse.json({
    success: true,
    message: "Thank you for your interest! We've added you to our waiting list and will notify you when we expand to your area.",
  });
}
