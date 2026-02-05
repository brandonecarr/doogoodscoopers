import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Map frontend frequency values to database values
const frequencyMap: Record<string, string> = {
  once_a_week: "WEEKLY",
  two_times_a_week: "WEEKLY", // Twice weekly uses weekly pricing as base
  weekly: "WEEKLY",
  bi_weekly: "BIWEEKLY",
  biweekly: "BIWEEKLY",
  once_a_month: "MONTHLY",
  monthly: "MONTHLY",
  one_time: "ONETIME",
  onetime: "ONETIME",
};

// Initial cleanup fee brackets based on lastCleaned value
const initialCleanupBrackets: Record<string, { name: string; multiplier: number }> = {
  one_week: { name: "Initial Cleanup - Light", multiplier: 0 },
  two_weeks: { name: "Initial Cleanup - Light", multiplier: 0 },
  three_weeks: { name: "Initial Cleanup - Moderate", multiplier: 1 },
  one_month: { name: "Initial Cleanup - Moderate", multiplier: 1 },
  two_months: { name: "Initial Cleanup - Heavy", multiplier: 1 },
  "3-4_months": { name: "Initial Cleanup - Heavy", multiplier: 1 },
  "5-6_months": { name: "Initial Cleanup - Deep", multiplier: 1 },
  "7-9_months": { name: "Initial Cleanup - Deep", multiplier: 1 },
  "10+_months": { name: "Initial Cleanup - Deep", multiplier: 1 },
};

interface PricingRule {
  id: string;
  name: string;
  frequency: string;
  min_dogs: number | null;
  max_dogs: number | null;
  base_price_cents: number;
  per_dog_price_cents: number;
  initial_cleanup_cents: number;
  priority: number;
}

interface AddOn {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  price_type: string;
  is_recurring: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const zipCode = searchParams.get("zipCode");
    const numberOfDogs = searchParams.get("numberOfDogs");
    const frequency = searchParams.get("frequency");
    const lastCleaned = searchParams.get("lastCleaned");

    // Validate required parameters
    if (!zipCode || !numberOfDogs || !frequency) {
      return NextResponse.json(
        { error: "Missing required parameters: zipCode, numberOfDogs, frequency" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const numDogs = parseInt(numberOfDogs) || 1;
    const dbFrequency = frequencyMap[frequency.toLowerCase()] || frequency.toUpperCase();

    // Get the default organization
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

    // Find the matching pricing rule
    const { data: rules, error: rulesError } = await supabase
      .from("pricing_rules")
      .select("*")
      .eq("org_id", org.id)
      .eq("is_active", true)
      .eq("frequency", dbFrequency)
      .order("priority", { ascending: false });

    if (rulesError) {
      console.error("Failed to fetch pricing rules:", rulesError);
      return NextResponse.json(
        { error: "Unable to fetch pricing information" },
        { status: 500 }
      );
    }

    // Find the best matching rule for the number of dogs
    const typedRules = rules as PricingRule[];
    const matchingRule = typedRules.find((rule) => {
      const minDogs = rule.min_dogs ?? 1;
      const maxDogs = rule.max_dogs ?? 99;
      return numDogs >= minDogs && numDogs <= maxDogs;
    });

    if (!matchingRule) {
      return NextResponse.json({
        success: true,
        pricing: {
          basePrice: 0,
          recurringPrice: 0,
          monthlyPrice: 0,
          initialCleanupFee: 0,
          total: 0,
          frequency,
          numberOfDogs,
          priceNotConfigured: true,
          customPriceDescription: "Please contact us for a custom quote.",
        },
        crossSells: [],
      });
    }

    // Calculate the price
    let basePriceCents = matchingRule.base_price_cents;

    // Add per-dog price for dogs beyond the base
    if (matchingRule.per_dog_price_cents > 0 && matchingRule.min_dogs) {
      const extraDogs = Math.max(0, numDogs - matchingRule.min_dogs);
      basePriceCents += extraDogs * matchingRule.per_dog_price_cents;
    }

    // Handle twice weekly (double the weekly price)
    if (frequency === "two_times_a_week") {
      basePriceCents = Math.round(basePriceCents * 2);
    }

    const perVisitPrice = basePriceCents / 100;

    // Calculate monthly price estimate
    const visitsPerMonth: Record<string, number> = {
      WEEKLY: 4.33,
      BIWEEKLY: 2.17,
      MONTHLY: 1,
      ONETIME: 1,
    };
    // For twice weekly
    const effectiveVisits = frequency === "two_times_a_week" ? 8.67 : visitsPerMonth[dbFrequency] || 4.33;
    const monthlyPrice = Math.round(perVisitPrice * effectiveVisits * 100) / 100;

    // Get initial cleanup fee from add-ons
    let initialCleanupFee = 0;
    let initialCleanupAddOnId: string | null = null;

    if (lastCleaned) {
      const bracket = initialCleanupBrackets[lastCleaned];
      if (bracket && bracket.multiplier > 0) {
        // Fetch the matching add-on
        const { data: addOns } = await supabase
          .from("add_ons")
          .select("id, name, price_cents")
          .eq("org_id", org.id)
          .eq("is_active", true)
          .eq("name", bracket.name)
          .single<{ id: string; name: string; price_cents: number }>();

        if (addOns) {
          initialCleanupFee = addOns.price_cents / 100;
          initialCleanupAddOnId = addOns.id;
        }
      }
    }

    // Get cross-sells from onboarding settings (where admin configures them)
    const { data: onboardingSettings } = await supabase
      .from("onboarding_settings")
      .select("settings")
      .eq("org_id", org.id)
      .single<{ settings: { residentialCrossSells?: { items?: Array<{ id: string; name: string; description: string; pricePerUnit: number; unit: string }>; placement?: string } } }>();

    // Extract cross-sells from settings, respecting the placement setting
    const crossSellsSettings = onboardingSettings?.settings?.residentialCrossSells;
    const crossSellsPlacement = crossSellsSettings?.placement || "BOTTOM";

    // Only include cross-sells if placement is not "DONT_SHOW"
    const crossSells = crossSellsPlacement !== "DONT_SHOW"
      ? (crossSellsSettings?.items || []).map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          unit_amount: item.pricePerUnit / 100, // Convert cents to dollars
          unit: item.unit,
        }))
      : [];

    return NextResponse.json({
      success: true,
      pricing: {
        basePrice: perVisitPrice,
        recurringPrice: perVisitPrice,
        monthlyPrice: dbFrequency !== "ONETIME" ? monthlyPrice : undefined,
        initialCleanupFee,
        initialCleanupCrossSellId: initialCleanupAddOnId,
        taxRate: 0,
        total: perVisitPrice,
        frequency,
        numberOfDogs,
        billingInterval: "per_visit",
        priceNotConfigured: false,
      },
      crossSells,
    });
  } catch (error) {
    console.error("Error fetching pricing:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching pricing" },
      { status: 500 }
    );
  }
}
