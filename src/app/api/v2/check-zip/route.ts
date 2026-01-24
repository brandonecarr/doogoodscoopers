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

    // Check if zip code is in any active pricing rule
    const { data: rules, error: rulesError } = await supabase
      .from("pricing_rules")
      .select("id, zip_codes")
      .eq("org_id", org.id)
      .eq("is_active", true)
      .returns<{ id: string; zip_codes: string[] | null }[]>();

    if (rulesError) {
      console.error("Failed to check pricing rules:", rulesError);
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
