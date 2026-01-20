import { NextRequest, NextResponse } from "next/server";

const SWEEPANDGO_API_URL = process.env.SWEEPANDGO_API_URL || "https://openapi.sweepandgo.com";
const SWEEPANDGO_TOKEN = process.env.SWEEPANDGO_TOKEN || process.env.SWEEPANDGO_TOKEN;
const SWEEPANDGO_ORG_SLUG = process.env.SWEEPANDGO_ORG_SLUG || "doogoodscoopers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { zipCode } = body;

    // Validate zip code format
    if (!zipCode || !/^\d{5}$/.test(zipCode)) {
      return NextResponse.json(
        { error: "Please enter a valid 5-digit ZIP code", inServiceArea: false },
        { status: 400 }
      );
    }

    if (!SWEEPANDGO_TOKEN) {
      console.error("SWEEPANDGO_TOKEN is not configured");
      return NextResponse.json(
        { error: "Service configuration error", inServiceArea: false },
        { status: 500 }
      );
    }

    console.log("Checking zip code:", zipCode, "with org:", SWEEPANDGO_ORG_SLUG);

    // Call Sweep&Go API to check if zip code is in service area
    // The API expects a "value" field for the zip code
    const response = await fetch(
      `${SWEEPANDGO_API_URL}/api/v2/client_on_boarding/check_zip_code_exists`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SWEEPANDGO_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          zip_code: zipCode,
        }),
      }
    );

    console.log("Sweep&Go API status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Sweep&Go API error:", response.status, errorText);

      // If it's a 404, the zip code is likely not in service area
      if (response.status === 404) {
        return NextResponse.json({
          inServiceArea: false,
          message: "We don't currently serve this area, but we're expanding!",
        });
      }

      // If it's a 422 (Unprocessable Entity), the zip might not exist
      if (response.status === 422) {
        return NextResponse.json({
          inServiceArea: false,
          message: "We don't currently serve this area, but we're expanding!",
          debug: { status: 422, error: errorText },
        });
      }

      // Return more debug info to help troubleshoot
      return NextResponse.json(
        {
          error: "Unable to verify service area",
          inServiceArea: false,
          debug: { status: response.status, error: errorText }
        },
        { status: 500 }
      );
    }

    const data = await response.json();

    // Log the full response to see what we're getting
    console.log("Sweep&Go API response:", JSON.stringify(data, null, 2));

    // Check various possible response structures from Sweep&Go
    // The API returns { "exists": "exists" } when the zip code is in service area
    const inServiceArea =
      data.exists === "exists" ||
      data.exists === true ||
      data.success === true ||
      data.in_service_area === true ||
      data.zip_code_exists === true ||
      data.available === true;

    return NextResponse.json({
      inServiceArea,
      message: inServiceArea
        ? "Great news! We service your area."
        : "We don't currently serve this area, but we're expanding!",
      zipCode,
      debug: data, // Include the raw response for debugging
    });

  } catch (error) {
    console.error("Error checking zip code:", error);
    return NextResponse.json(
      { error: "An error occurred while checking your ZIP code", inServiceArea: false },
      { status: 500 }
    );
  }
}
