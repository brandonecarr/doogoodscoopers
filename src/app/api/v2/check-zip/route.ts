import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
      return NextResponse.json(
        { error: "Service configuration error", inServiceArea: false },
        { status: 500 }
      );
    }

    // Check if zip code is in the Service Area rules (REGULAR or PREMIUM)
    const { data: rules, error: rulesError } = await supabase
      .from("pricing_rules")
      .select("id, name, zone, zip_codes")
      .eq("org_id", org.id)
      .eq("is_active", true)
      .in("name", ["Service Area - REGULAR", "Service Area - PREMIUM"])
      .returns<{ id: string; name: string; zone: string; zip_codes: string[] | null }[]>();

    if (rulesError) {
      console.error("Failed to check pricing rules:", rulesError);
      return NextResponse.json(
        { error: "Unable to verify service area", inServiceArea: false },
        { status: 500 }
      );
    }

    // Check if the zip code exists in any Service Area rule
    let inServiceArea = false;
    let pricingZone: "REGULAR" | "PREMIUM" | null = null;

    for (const rule of rules || []) {
      const zipCodes = rule.zip_codes as string[] | null;
      if (zipCodes && zipCodes.includes(zipCode)) {
        inServiceArea = true;
        pricingZone = rule.zone as "REGULAR" | "PREMIUM";
        break;
      }
    }

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
      pricingZone,
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
