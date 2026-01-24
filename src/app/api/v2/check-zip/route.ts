import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Feature flag to use Sweep&Go as fallback
const USE_SWEEPANDGO_FALLBACK = process.env.FEATURE_FLAG_COMPAT_SWEEPNGO === "true";

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

    const supabase = await createClient();

    // Get the default organization (single-tenant for now)
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, slug")
      .eq("slug", "doogoodscoopers")
      .single<{ id: string; slug: string }>();

    if (orgError || !org) {
      console.error("Failed to get organization:", orgError);

      // Fall back to Sweep&Go if enabled
      if (USE_SWEEPANDGO_FALLBACK) {
        return await checkZipViaSweepAndGo(zipCode);
      }

      return NextResponse.json(
        { error: "Service configuration error", inServiceArea: false },
        { status: 500 }
      );
    }

    // Check if zip code is in any active pricing rule
    const { data: rules, error: rulesError } = await supabase
      .from("pricing_rules")
      .select("id, zip_codes")
      .eq("org_id", org.id)
      .eq("is_active", true)
      .returns<{ id: string; zip_codes: string[] | null }[]>();

    if (rulesError) {
      console.error("Failed to check pricing rules:", rulesError);

      // Fall back to Sweep&Go if enabled
      if (USE_SWEEPANDGO_FALLBACK) {
        return await checkZipViaSweepAndGo(zipCode);
      }

      return NextResponse.json(
        { error: "Unable to verify service area", inServiceArea: false },
        { status: 500 }
      );
    }

    // Check if the zip code exists in any rule's zip_codes array
    const inServiceArea = rules?.some((rule) => {
      const zipCodes = rule.zip_codes as string[] | null;
      return zipCodes && zipCodes.includes(zipCode);
    }) ?? false;

    // Also check zip_frequency_restrictions for blocked zips
    if (inServiceArea) {
      const { data: restrictions } = await supabase
        .from("zip_frequency_restrictions")
        .select("id, blocked_frequencies")
        .eq("org_id", org.id)
        .eq("zip", zipCode)
        .single<{ id: string; blocked_frequencies: string[] }>();

      // If all frequencies are blocked, treat as out of service area
      const allFrequencies = ["WEEKLY", "BIWEEKLY", "MONTHLY", "ONETIME"];
      if (restrictions?.blocked_frequencies?.length === allFrequencies.length) {
        return NextResponse.json({
          inServiceArea: false,
          message: "We don't currently serve this area, but we're expanding!",
          zipCode,
        });
      }
    }

    return NextResponse.json({
      inServiceArea,
      message: inServiceArea
        ? "Great news! We service your area."
        : "We don't currently serve this area, but we're expanding!",
      zipCode,
    });
  } catch (error) {
    console.error("Error checking zip code:", error);
    return NextResponse.json(
      { error: "An error occurred while checking your ZIP code", inServiceArea: false },
      { status: 500 }
    );
  }
}

// Fallback to Sweep&Go API (for compatibility mode)
async function checkZipViaSweepAndGo(zipCode: string): Promise<NextResponse> {
  const SWEEPANDGO_API_URL = process.env.SWEEPANDGO_API_URL || "https://openapi.sweepandgo.com";
  const SWEEPANDGO_TOKEN = process.env.SWEEPANDGO_TOKEN;
  const SWEEPANDGO_ORG_SLUG = process.env.SWEEPANDGO_ORG_SLUG || "doogoodscoopers";

  if (!SWEEPANDGO_TOKEN) {
    return NextResponse.json(
      { error: "Service configuration error", inServiceArea: false },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `${SWEEPANDGO_API_URL}/api/v2/client_on_boarding/check_zip_code_exists`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SWEEPANDGO_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organization: SWEEPANDGO_ORG_SLUG,
          value: zipCode,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 404 || response.status === 422) {
        return NextResponse.json({
          inServiceArea: false,
          message: "We don't currently serve this area, but we're expanding!",
        });
      }
      throw new Error(`Sweep&Go API error: ${response.status}`);
    }

    const data = await response.json();
    const inServiceArea =
      data.exists === "exists" ||
      data.exists === true ||
      data.success === true;

    return NextResponse.json({
      inServiceArea,
      message: inServiceArea
        ? "Great news! We service your area."
        : "We don't currently serve this area, but we're expanding!",
      zipCode,
    });
  } catch (error) {
    console.error("Sweep&Go fallback error:", error);
    return NextResponse.json(
      { error: "Unable to verify service area", inServiceArea: false },
      { status: 500 }
    );
  }
}
