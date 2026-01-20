import { NextRequest, NextResponse } from "next/server";

const SWEEPANDGO_API_URL = process.env.SWEEPANDGO_API_URL || "https://openapi.sweepandgo.com";
const SWEEPANDGO_API_KEY = process.env.SWEEPANDGO_API_KEY;
const SWEEPANDGO_ORG_SLUG = process.env.SWEEPANDGO_ORG_SLUG || "doogoodscoopers";

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

    if (!SWEEPANDGO_API_KEY) {
      console.error("SWEEPANDGO_API_KEY is not configured");
      return NextResponse.json(
        { error: "Service configuration error" },
        { status: 500 }
      );
    }

    // Build query string for Sweep&Go API
    const params = new URLSearchParams({
      organization: SWEEPANDGO_ORG_SLUG,
      number_of_dogs: numberOfDogs,
      zip_code: zipCode,
      clean_up_frequency: frequency,
    });

    if (lastCleaned) {
      params.append("last_time_yard_was_thoroughly_cleaned", lastCleaned);
    }

    // Call Sweep&Go API to get pricing
    const response = await fetch(
      `${SWEEPANDGO_API_URL}/api/v2/client_on_boarding/price_registration_form?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${SWEEPANDGO_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Sweep&Go pricing API URL:", `${SWEEPANDGO_API_URL}/api/v2/client_on_boarding/price_registration_form?${params.toString()}`);
    console.log("Sweep&Go pricing API status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Sweep&Go pricing API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Unable to fetch pricing information", debug: { status: response.status, error: errorText } },
        { status: 500 }
      );
    }

    const data = await response.json();

    // Log the raw response for debugging
    console.log("Sweep&Go pricing API response:", JSON.stringify(data, null, 2));

    // Parse the price value - Sweep&Go returns price as an object: { price: { value: "85.00", category: "prepaid", billing_interval: "monthly" } }
    // Or sometimes as a flat value field, or null if not configured
    let recurringPrice = 0;
    let billingInterval = data.show_price_options?.default_billing_interval || "per_visit";
    let category = "";
    let customPriceDescription = "";

    if (data.price && typeof data.price === 'object') {
      // Price is nested: data.price.value
      recurringPrice = parseFloat(data.price.value) || 0;
      billingInterval = data.price.billing_interval || billingInterval;
      category = data.price.category || "";
    } else if (data.price !== null) {
      // Try flat structure (only if price is not explicitly null)
      recurringPrice = parseFloat(data.value) || parseFloat(data.price) || parseFloat(data.recurring_price) || 0;
      category = data.category || "";
    }

    // Check for custom price description (used when price is null but there's custom pricing info)
    if (data.custom_price) {
      customPriceDescription = data.custom_price.long_description || data.custom_price.short_description || "";

      // Try to extract initial cleanup fee from custom_price description (e.g., "$99 Initial Cleaning Fee")
      const priceMatch = customPriceDescription.match(/\$(\d+(?:\.\d{2})?)/);
      if (priceMatch && !recurringPrice) {
        // This might be an initial fee, not recurring
      }
    }

    const taxRate = parseFloat(data.tax_percent) || parseFloat(data.tax_percentage) || 0;

    // Check for initial cleanup fee in the response, custom_price, or cross-sells
    let initialCleanupFee = parseFloat(data.initial_cleanup_fee) || parseFloat(data.one_time_fee) || 0;

    // Extract initial fee from custom_price if available (e.g., "$99 Initial Cleaning Fee")
    if (!initialCleanupFee && data.custom_price?.short_description) {
      const feeMatch = data.custom_price.short_description.match(/\$(\d+(?:\.\d{2})?)/);
      if (feeMatch) {
        initialCleanupFee = parseFloat(feeMatch[1]) || 0;
      }
    }

    // Some configurations may have initial cleanup as a cross-sell
    if (data.cross_sells && Array.isArray(data.cross_sells)) {
      const initialCleanup = data.cross_sells.find(
        (cs: Record<string, unknown>) => {
          const name = typeof cs.name === 'string' ? cs.name.toLowerCase() : '';
          const service = typeof cs.service === 'string' ? cs.service.toLowerCase() : '';
          return name.includes('initial') || service.includes('initial');
        }
      );
      if (initialCleanup && !initialCleanupFee) {
        initialCleanupFee = parseFloat(String(initialCleanup.unit_amount)) || 0;
      }
    }

    // Calculate per-visit price if the billing interval is monthly
    // We need to divide the monthly price by the number of visits per month based on frequency
    let perVisitPrice = recurringPrice;
    let monthlyPrice = recurringPrice;

    if (billingInterval === "monthly" && recurringPrice > 0) {
      // Calculate visits per month based on frequency
      const visitsPerMonth: Record<string, number> = {
        "two_times_a_week": 8.67,  // ~2 visits × 4.33 weeks
        "once_a_week": 4.33,       // ~1 visit × 4.33 weeks
        "bi_weekly": 2.17,         // ~0.5 visits × 4.33 weeks
        "once_a_month": 1,
        "one_time": 1,
      };

      const visits = visitsPerMonth[frequency as string] || 4.33; // Default to weekly
      perVisitPrice = Math.round((recurringPrice / visits) * 100) / 100; // Round to 2 decimal places
    } else if (billingInterval === "per_visit") {
      // Price is already per visit, calculate monthly estimate
      const visitsPerMonth: Record<string, number> = {
        "two_times_a_week": 8.67,
        "once_a_week": 4.33,
        "bi_weekly": 2.17,
        "once_a_month": 1,
        "one_time": 1,
      };
      const visits = visitsPerMonth[frequency as string] || 4.33;
      monthlyPrice = Math.round((recurringPrice * visits) * 100) / 100;
    }

    // Transform the response to a cleaner format for our frontend
    return NextResponse.json({
      success: true,
      pricing: {
        basePrice: recurringPrice,
        recurringPrice: perVisitPrice,      // Per-visit price for display
        monthlyPrice: monthlyPrice,          // Monthly total
        initialCleanupFee: initialCleanupFee,
        taxRate: taxRate,
        total: recurringPrice,
        frequency: frequency,
        numberOfDogs: numberOfDogs,
        billingInterval: billingInterval,
        category: category,
        customPriceDescription: customPriceDescription,
        priceNotConfigured: data.price === null,
      },
      crossSells: data.cross_sells || [],
      formConfig: data.form_fields || {},
      debug: data, // Include raw response for debugging
    });

  } catch (error) {
    console.error("Error fetching pricing:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching pricing", debug: { message: error instanceof Error ? error.message : String(error) } },
      { status: 500 }
    );
  }
}
