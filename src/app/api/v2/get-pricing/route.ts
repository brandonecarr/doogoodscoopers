import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Feature flag to use Sweep&Go as fallback
const USE_SWEEPANDGO_FALLBACK = process.env.FEATURE_FLAG_COMPAT_SWEEPNGO === "true";

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

      // Fall back to Sweep&Go if enabled
      if (USE_SWEEPANDGO_FALLBACK) {
        return await getPricingViaSweepAndGo(zipCode, numberOfDogs, frequency, lastCleaned);
      }

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

      if (USE_SWEEPANDGO_FALLBACK) {
        return await getPricingViaSweepAndGo(zipCode, numberOfDogs, frequency, lastCleaned);
      }

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
      // Fall back to default or Sweep&Go
      if (USE_SWEEPANDGO_FALLBACK) {
        return await getPricingViaSweepAndGo(zipCode, numberOfDogs, frequency, lastCleaned);
      }

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

    // Get available cross-sells (recurring add-ons)
    const { data: addOns } = await supabase
      .from("add_ons")
      .select("id, name, description, price_cents, price_type, is_recurring")
      .eq("org_id", org.id)
      .eq("is_active", true)
      .eq("is_recurring", true)
      .order("sort_order", { ascending: true });

    const crossSells = (addOns as AddOn[] | null)?.map((addOn) => ({
      id: addOn.id,
      name: addOn.name,
      description: addOn.description,
      unit_amount: addOn.price_cents / 100,
      price_type: addOn.price_type,
    })) || [];

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

// Fallback to Sweep&Go API (for compatibility mode)
async function getPricingViaSweepAndGo(
  zipCode: string,
  numberOfDogs: string,
  frequency: string,
  lastCleaned: string | null
): Promise<NextResponse> {
  const SWEEPANDGO_API_URL = process.env.SWEEPANDGO_API_URL || "https://openapi.sweepandgo.com";
  const SWEEPANDGO_TOKEN = process.env.SWEEPANDGO_TOKEN;
  const SWEEPANDGO_ORG_SLUG = process.env.SWEEPANDGO_ORG_SLUG || "doogoodscoopers";

  if (!SWEEPANDGO_TOKEN) {
    return NextResponse.json(
      { error: "Service configuration error" },
      { status: 500 }
    );
  }

  try {
    const params = new URLSearchParams({
      organization: SWEEPANDGO_ORG_SLUG,
      number_of_dogs: numberOfDogs,
      zip_code: zipCode,
      clean_up_frequency: frequency,
    });

    if (lastCleaned) {
      params.append("last_time_yard_was_thoroughly_cleaned", lastCleaned);
    }

    const response = await fetch(
      `${SWEEPANDGO_API_URL}/api/v2/client_on_boarding/price_registration_form?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${SWEEPANDGO_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Sweep&Go API error: ${response.status}`);
    }

    const data = await response.json();

    // Parse the Sweep&Go response (same logic as original get-pricing route)
    let recurringPrice = 0;
    let billingInterval = data.show_price_options?.default_billing_interval || "per_visit";

    if (data.price && typeof data.price === "object") {
      recurringPrice = parseFloat(data.price.value) || 0;
      billingInterval = data.price.billing_interval || billingInterval;
    }

    let initialCleanupFee = parseFloat(data.initial_cleanup_fee) || 0;
    let initialCleanupCrossSellId: number | null = null;

    if (data.cross_sells && Array.isArray(data.cross_sells)) {
      const initialCleanup = data.cross_sells.find(
        (cs: { name?: string; service?: string }) => {
          const name = typeof cs.name === "string" ? cs.name.toLowerCase() : "";
          return name.includes("initial");
        }
      );
      if (initialCleanup) {
        initialCleanupCrossSellId = initialCleanup.id;
        if (!initialCleanupFee) {
          initialCleanupFee = parseFloat(String(initialCleanup.unit_amount)) || 0;
        }
      }
    }

    return NextResponse.json({
      success: true,
      pricing: {
        basePrice: recurringPrice,
        recurringPrice,
        initialCleanupFee,
        initialCleanupCrossSellId,
        taxRate: parseFloat(data.tax_percent) || 0,
        total: recurringPrice,
        frequency,
        numberOfDogs,
        billingInterval,
        priceNotConfigured: data.price === null,
      },
      crossSells: data.cross_sells || [],
    });
  } catch (error) {
    console.error("Sweep&Go fallback error:", error);
    return NextResponse.json(
      { error: "Unable to fetch pricing information" },
      { status: 500 }
    );
  }
}
