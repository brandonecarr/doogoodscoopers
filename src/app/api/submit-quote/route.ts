import { NextRequest, NextResponse } from "next/server";

const SWEEPANDGO_API_URL = process.env.SWEEPANDGO_API_URL || "https://openapi.sweepandgo.com";
const SWEEPANDGO_TOKEN = process.env.SWEEPANDGO_TOKEN || process.env.SWEEPANDGO_TOKEN;
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
  termsAccepted?: boolean;
  billingInterval?: string;
  category?: string;
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

  // Submit to Sweep&Go create_client_with_package endpoint
  // This creates the client and sets up their payment method
  const payload = {
    organization: SWEEPANDGO_ORG_SLUG,
    email: data.email,
    first_name: data.firstName,
    last_name: data.lastName,
    phone_numbers: [data.phone],
    home_address: data.address,
    city: data.city,
    state: data.state || "CA",
    zip_code: data.zipCode,
    number_of_dogs: data.numberOfDogs,
    clean_up_frequency: data.frequency,
    last_time_yard_was_thoroughly_cleaned: data.lastCleaned || "more_than_2_weeks",
    // Payment fields
    credit_card_token: data.creditCardToken,
    name_on_card: data.nameOnCard,
    terms_open_api: true, // User accepted terms in the form
    billing_interval: data.billingInterval || "per_visit",
    category: data.category || "prepaid",
    // Optional fields
    dog_name: data.dogNames || [],
    dog_breed: data.dogBreeds || [],
    safe_dog: data.safeDogs || [],
  };

  console.log("Submitting to create_client_with_package:", JSON.stringify(payload, null, 2));

  const response = await fetch(
    `${SWEEPANDGO_API_URL}/api/v2/client_on_boarding/create_client_with_package`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SWEEPANDGO_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  console.log("Sweep&Go create_client_with_package status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sweep&Go create_client_with_package error:", response.status, errorText);

    // Try to parse error for more specific message
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
  console.log("Sweep&Go create_client_with_package response:", JSON.stringify(result, null, 2));

  return NextResponse.json({
    success: true,
    message: "Welcome to Doo Good Scoopers! Your service registration is complete.",
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
