import { NextRequest, NextResponse } from "next/server";

const SWEEPANDGO_API_URL = process.env.SWEEPANDGO_API_URL || "https://openapi.sweepandgo.com";
const SWEEPANDGO_TOKEN = process.env.SWEEPANDGO_TOKEN;
const SWEEPANDGO_ORG_SLUG = process.env.SWEEPANDGO_ORG_SLUG || "doogoodscoopers";

interface FreeQuoteSubmission {
  zipCode: string;
  numberOfDogs: string;
  frequency: string;
  lastCleaned?: string;
  firstName?: string;
  phone?: string;
  email?: string;
  couponCode?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: FreeQuoteSubmission = await request.json();

    // Validate required fields
    if (!body.zipCode || !body.numberOfDogs || !body.frequency) {
      return NextResponse.json(
        { error: "Missing required fields: zipCode, numberOfDogs, frequency" },
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

    const results: { endpoint: string; method: string; status: number; error?: string }[] = [];

    // Try 1: PUT to residential onboarding (creates a lead/partial registration)
    // This is the main endpoint that accepts all the quote fields
    // Generate a placeholder email if not provided (required field)
    const placeholderEmail = body.email || `quote-${Date.now()}@doogoodscoopers.com`;

    const onboardingPayload = {
      organization: SWEEPANDGO_ORG_SLUG,
      zip_code: String(body.zipCode), // Must be string
      number_of_dogs: parseInt(body.numberOfDogs) || 1,
      clean_up_frequency: body.frequency,
      last_time_yard_was_thoroughly_cleaned: body.lastCleaned || "one_week",
      first_name: body.firstName || "Website Visitor",
      last_name: "Quote Request",
      email: placeholderEmail, // Required field
      cell_phone_number: body.phone || "",
      city: "Pending", // Required field - placeholder
      home_address: "Quote Request - Address TBD", // Required field - placeholder
      state: "CA",
      initial_cleanup_required: true, // Must be true or false, not false as invalid
      coupon_code: body.couponCode || "",
    };

    console.log("Submitting to residential/onboarding:", JSON.stringify(onboardingPayload, null, 2));

    try {
      const onboardingResponse = await fetch(
        `${SWEEPANDGO_API_URL}/api/v1/residential/onboarding`,
        {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${SWEEPANDGO_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(onboardingPayload),
        }
      );

      console.log("Sweep&Go residential/onboarding status:", onboardingResponse.status);

      if (onboardingResponse.ok) {
        const result = await onboardingResponse.json();
        console.log("Sweep&Go residential/onboarding response:", JSON.stringify(result, null, 2));

        return NextResponse.json({
          success: true,
          message: "Free quote lead submitted successfully",
          endpoint: "/api/v1/residential/onboarding",
          data: result,
        });
      }

      const errorText = await onboardingResponse.text();
      console.error("Sweep&Go residential/onboarding error:", onboardingResponse.status, errorText);
      results.push({
        endpoint: "/api/v1/residential/onboarding",
        method: "PUT",
        status: onboardingResponse.status,
        error: errorText
      });
    } catch (err) {
      console.error("Error calling residential/onboarding:", err);
      results.push({
        endpoint: "/api/v1/residential/onboarding",
        method: "PUT",
        status: 0,
        error: err instanceof Error ? err.message : String(err)
      });
    }

    // Try 2: POST to create_client_with_package (without payment - may create lead)
    const clientPayload = {
      organization: SWEEPANDGO_ORG_SLUG,
      zip_code: String(body.zipCode),
      number_of_dogs: String(body.numberOfDogs),
      clean_up_frequency: body.frequency,
      last_time_yard_was_thoroughly_cleaned: body.lastCleaned || "one_week",
      first_name: body.firstName || "Website Visitor",
      last_name: "Quote Request",
      email: placeholderEmail,
      phone_numbers: body.phone ? [body.phone] : [],
      city: "Pending", // Required field
      home_address: "Quote Request - Address TBD", // Required field
      state: "CA",
      cross_sell_id: [], // Required field - empty array
    };

    console.log("Submitting to create_client_with_package:", JSON.stringify(clientPayload, null, 2));

    try {
      const clientResponse = await fetch(
        `${SWEEPANDGO_API_URL}/api/v2/client_on_boarding/create_client_with_package`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SWEEPANDGO_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(clientPayload),
        }
      );

      console.log("Sweep&Go create_client_with_package status:", clientResponse.status);

      if (clientResponse.ok) {
        const result = await clientResponse.json();
        console.log("Sweep&Go create_client_with_package response:", JSON.stringify(result, null, 2));

        return NextResponse.json({
          success: true,
          message: "Free quote lead submitted successfully",
          endpoint: "/api/v2/client_on_boarding/create_client_with_package",
          data: result,
        });
      }

      const errorText = await clientResponse.text();
      console.error("Sweep&Go create_client_with_package error:", clientResponse.status, errorText);
      results.push({
        endpoint: "/api/v2/client_on_boarding/create_client_with_package",
        method: "POST",
        status: clientResponse.status,
        error: errorText
      });
    } catch (err) {
      console.error("Error calling create_client_with_package:", err);
      results.push({
        endpoint: "/api/v2/client_on_boarding/create_client_with_package",
        method: "POST",
        status: 0,
        error: err instanceof Error ? err.message : String(err)
      });
    }

    // All endpoints failed - return success anyway to not block user
    console.error("All free quote endpoints failed:", results);
    return NextResponse.json({
      success: true,
      message: "Quote displayed to user",
      debug: { attempts: results },
    });

  } catch (error) {
    console.error("Error submitting free quote:", error);
    // Return success anyway to not block user flow
    return NextResponse.json({
      success: true,
      message: "Quote submitted",
      debug: { error: error instanceof Error ? error.message : String(error) },
    });
  }
}
