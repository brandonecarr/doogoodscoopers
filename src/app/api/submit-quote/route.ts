import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const SWEEPANDGO_API_URL = process.env.SWEEPANDGO_API_URL || "https://openapi.sweepandgo.com";
const SWEEPANDGO_TOKEN = process.env.SWEEPANDGO_TOKEN;
const SWEEPANDGO_ORG_SLUG = process.env.SWEEPANDGO_ORG_SLUG || "doogoodscoopers";

interface DogInfo {
  name: string;
  breed?: string;
  safe_dog?: boolean;
  comments?: string;
}

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

  // Dog info - support both formats
  dogs?: DogInfo[]; // New format from frontend
  dogNames?: string[];
  dogBreeds?: string[];
  safeDogs?: boolean[];

  // Notification preferences
  cleanupNotificationType?: string[];
  cleanupNotificationChannel?: string;

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
  // Debug: Log what we received from the frontend
  console.log("=== RECEIVED FROM FRONTEND ===");
  console.log("creditCardToken:", data.creditCardToken);
  console.log("creditCardToken type:", typeof data.creditCardToken);
  console.log("creditCardToken length:", data.creditCardToken?.length);
  console.log("nameOnCard:", data.nameOnCard);
  console.log("Full data object keys:", Object.keys(data));

  // Validate payment info is present
  if (!data.creditCardToken || !data.nameOnCard) {
    console.log("VALIDATION FAILED - missing payment info");
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

  // Extract dog info - support both array of objects (new) and separate arrays (legacy)
  let dogNames: string[] = [];
  let dogBreeds: string[] = [];
  let safeDogs: boolean[] = [];
  let dogComments: string[] = [];

  if (data.dogs && data.dogs.length > 0) {
    // New format: array of dog objects
    // Frontend sends safe_dog: true for safe dogs, false for dangerous dogs
    // We preserve the actual value from frontend
    dogNames = data.dogs.map(d => d.name || "");
    dogBreeds = data.dogs.map(d => d.breed || "");
    safeDogs = data.dogs.map(d => d.safe_dog === true); // Explicitly check for true
    dogComments = data.dogs.map(d => d.comments || "");
    console.log("Parsed dogs from array format:", { dogNames, dogBreeds, safeDogs, dogComments });
  } else if (data.dogNames) {
    // Legacy format: separate arrays
    dogNames = data.dogNames;
    dogBreeds = data.dogBreeds || [];
    safeDogs = data.safeDogs || [];
    console.log("Using legacy dog arrays:", { dogNames, dogBreeds, safeDogs });
  }

  // Extract notification preferences
  const notificationType = data.cleanupNotificationType?.join(",") || "";
  const notificationChannel = data.cleanupNotificationChannel || "";
  console.log("Notification preferences:", { notificationType, notificationChannel });

  // Try v2 API first - create_client_with_package may have better Stripe support
  const v2Payload: Record<string, unknown> = {
    organization: SWEEPANDGO_ORG_SLUG,
    organization_id: "doogoodscoopers-obc2w", // v2 API requires organization_id (different from slug)
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
    // Payment fields - Sweep&Go only needs token and name for Stripe
    credit_card_token: data.creditCardToken,
    name_on_card: data.nameOnCard,
    terms_open_api: true,
    // Dog info - extracted from either format
    dog_name: dogNames,
    dog_breed: dogBreeds,
    safe_dog: safeDogs,
    dog_comment: dogComments,
    // Notification preferences
    cleanup_notification_type: notificationType,
    cleanup_notification_channel: notificationChannel,
    // Cross-sell IDs - v2 API requires this field even if empty
    // Try sending as empty array, or "0", or null to see what works
    cross_sell_id: data.crossSells && data.crossSells.length > 0
      ? data.crossSells.map(String)
      : ["0"], // Try sending "0" as a placeholder for no cross-sells
  };

  console.log("=== SWEEP&GO V2 SUBMISSION ===");
  console.log("Payload:", JSON.stringify(v2Payload, null, 2));
  console.log("Credit card token:", data.creditCardToken);
  console.log("Expiry:", data.expiry);
  console.log("Name on card:", data.nameOnCard);

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

  // Track which API was used for logging
  let apiUsed = "v2";

  // If v2 fails, fall back to v1
  if (!response.ok) {
    const v2ErrorText = await response.text();
    console.log("=== V2 API FAILED ===");
    console.log("Status:", response.status);
    console.log("Error:", v2ErrorText);
    console.log("Falling back to v1 residential onboarding...");
    apiUsed = "v1";

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
      // Payment fields - Sweep&Go only needs token and name for Stripe
      credit_card_token: data.creditCardToken,
      name_on_card: data.nameOnCard,
      terms_open_api: true,
      // Dog info - use extracted arrays
      dog_name: dogNames,
      dog_breed: dogBreeds,
      safe_dog: safeDogs,
      dog_comment: dogComments,
      // Notification preferences
      cleanup_notification_type: notificationType,
      cleanup_notification_channel: notificationChannel,
      // Cross-sells
      cross_sells: data.crossSells?.map(String) || [],
    };

    console.log("=== SWEEP&GO V1 SUBMISSION ===");
    console.log("Payload:", JSON.stringify(v1Payload, null, 2));

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
  console.log(`=== SWEEP&GO ${apiUsed.toUpperCase()} SUCCESS ===`);
  console.log("Full response:", JSON.stringify(result, null, 2));

  // Log payment-related fields from response
  console.log("Payment info in response:", {
    has_credit_card: result.has_credit_card,
    payment_method: result.payment_method,
    billing: result.billing,
    credit_card: result.credit_card,
    card_on_file: result.card_on_file,
    stripe_customer_id: result.stripe_customer_id,
  });

  return NextResponse.json({
    success: true,
    message: "Welcome to DooGoodScoopers! Your service registration is complete.",
    data: result,
  });
}

async function submitOutOfServiceAreaLead(data: QuoteSubmission) {
  // Store in our database first
  try {
    await prisma.outOfAreaLead.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName || "",
        email: data.email || "",
        phone: data.phone || "",
        zipCode: data.zipCode,
      },
    });
  } catch (dbError) {
    console.error("Database error storing out-of-area lead:", dbError);
    // Continue even if DB fails - we still want to submit to Sweep&Go
  }

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
