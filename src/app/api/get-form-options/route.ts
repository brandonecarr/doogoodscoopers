import { NextResponse } from "next/server";

const SWEEPANDGO_API_URL = process.env.SWEEPANDGO_API_URL || "https://openapi.sweepandgo.com";
const SWEEPANDGO_TOKEN = process.env.SWEEPANDGO_TOKEN || process.env.SWEEPANDGO_TOKEN;
const SWEEPANDGO_ORG_SLUG = process.env.SWEEPANDGO_ORG_SLUG || "doogoodscoopers";

export async function GET() {
  try {
    if (!SWEEPANDGO_TOKEN) {
      console.error("SWEEPANDGO_TOKEN is not configured");
      return NextResponse.json(
        { error: "Service configuration error" },
        { status: 500 }
      );
    }

    // Fetch form options from Sweep&Go
    const response = await fetch(
      `${SWEEPANDGO_API_URL}/api/v2/client_on_boarding/service_registration_form?organization=${SWEEPANDGO_ORG_SLUG}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${SWEEPANDGO_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Sweep&Go form options error:", response.status, errorText);
      return NextResponse.json(
        { error: "Unable to fetch form options", debug: { status: response.status, error: errorText } },
        { status: 500 }
      );
    }

    const data = await response.json();

    // Return the form configuration
    return NextResponse.json({
      success: true,
      formOptions: data,
    });

  } catch (error) {
    console.error("Error fetching form options:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching form options" },
      { status: 500 }
    );
  }
}
