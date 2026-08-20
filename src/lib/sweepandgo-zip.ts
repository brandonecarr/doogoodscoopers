// Sweep&Go is the source of truth for the service area. This calls their official
// REST API (openapi.sweepandgo.com) directly with the account token — the same
// token the customer sync uses. Returns null on any error so callers can fall
// back to the local service-area list (never block the funnel on an SNG outage).

const SNG_SLUG = "doogoodscoopers-obc2w"; // org 1715
const SNG_BASE = "https://openapi.sweepandgo.com/api/v2";

function sngToken(): string | undefined {
  return process.env.SWEEPANDGO_API_TOKEN || process.env.SWEEPANDGO_WEBHOOK_SECRET || undefined;
}

export interface SngZipResult {
  inServiceArea: boolean;
  registrationUrl: string | null;
  raw?: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function truthy(v: any): boolean {
  return v === 1 || v === "1" || v === true || v === "true";
}

/** Check a ZIP against Sweep&Go's service area. null = couldn't reach SNG. */
export async function sngCheckZip(zip: string, includeRaw = false): Promise<SngZipResult | null> {
  const token = sngToken();
  if (!token || !/^\d{5}$/.test(zip)) return null;
  const url = `${SNG_BASE}/check_zip_code_multi_organizations?zip_code=${encodeURIComponent(zip)}&slugs[]=${encodeURIComponent(SNG_SLUG)}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = await res.json().catch(() => null);
    if (!d) return null;
    // Shape is defensively parsed (docs don't pin it down): the payload may be
    // flat, wrapped in `data`, or hold the org under an array keyed by slug.
    const node = d.data ?? d;
    const org = Array.isArray(node) ? node[0] : node?.[SNG_SLUG] ?? node?.organization ?? node;
    const outOfArea = truthy(node?.out_of_area) || truthy(org?.out_of_area);
    const regUrl = node?.registration_url || org?.registration_url || node?.url || null;
    return { inServiceArea: !outOfArea, registrationUrl: regUrl, ...(includeRaw ? { raw: d } : {}) };
  } catch {
    return null;
  }
}

// ── Pricing (Sweep&Go's real onboarding price) ───────────────────────────────

export interface SngPriceResult {
  amount?: number; // price.value
  interval?: string; // raw SNG billing_interval, e.g. "monthly"
  initialFee?: number; // parsed from custom_price text
  zipType?: string; // pricing_zip_code_type (regular | premium)
  priceNotConfigured: boolean;
  raw?: unknown;
}

// Funnel frequency values → Sweep&Go `clean_up_frequency`. Confirmed/adjusted by
// probing the live endpoint (the API docs don't pin these down).
const FREQ_MAP: Record<string, string> = {
  once_a_week: "once_a_week",
  two_times_a_week: "two_times_a_week",
  bi_weekly: "bi_weekly",
  once_a_month: "once_a_month",
  one_time: "one_time",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const num = (v: any): number | undefined => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && isFinite(n) ? n : undefined;
};

export async function sngPrice(opts: {
  zip: string; frequency: string; dogs: string; lastCleaned?: string; cfOverride?: string; includeRaw?: boolean; isOneTime?: boolean;
}): Promise<SngPriceResult | null> {
  const token = sngToken();
  if (!token || !/^\d{5}$/.test(opts.zip)) return null;
  const cf = opts.cfOverride || FREQ_MAP[opts.frequency] || opts.frequency;
  const p = new URLSearchParams({
    zip_code: opts.zip,
    clean_up_frequency: cf,
    number_of_dogs: String(opts.dogs || "1"),
    // Required by SNG. Defaults to the "it's been a while" bracket; the funnel
    // can collect this later for a more exact initial-cleanup fee.
    last_time_yard_was_thoroughly_cleaned: opts.lastCleaned || "over_a_month",
  });
  const url = `${SNG_BASE}/client_on_boarding/price_registration_form?${p.toString()}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return opts.includeRaw ? { priceNotConfigured: true, raw: { status: res.status, url, body } } : null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = await res.json().catch(() => null);
    if (!d) return null;
    const node = d.data ?? d;
    // The first $ in custom_price: for recurring it's the "$49 Initial Cleaning
    // Fee"; for one-time it's the actual price ("$99* For Your One-Time Cleanup").
    const cpText = [node?.custom_price?.short_description, node?.custom_price?.long_description].filter(Boolean).join(" ");
    const cpMatch = cpText.match(/\$\s?([\d,]+(?:\.\d+)?)/);
    const cpDollar = cpMatch ? num(cpMatch[1].replace(/,/g, "")) : undefined;

    if (opts.isOneTime) {
      // One-time: SNG returns no `price` object; the price is in custom_price.
      const amount = num(node?.price?.value) ?? cpDollar;
      return { amount, interval: "one_time", initialFee: undefined, zipType: node?.pricing_zip_code_type, priceNotConfigured: amount == null, ...(opts.includeRaw ? { raw: d } : {}) };
    }
    // Recurring: monthly price + a one-time initial cleaning fee.
    const amount = num(node?.price?.value ?? node?.price?.amount);
    const interval = node?.price?.billing_interval || node?.show_price_options?.default_billing_interval || undefined;
    return {
      amount, interval, initialFee: cpDollar,
      zipType: node?.pricing_zip_code_type,
      priceNotConfigured: amount == null,
      ...(opts.includeRaw ? { raw: d } : {}),
    };
  } catch {
    return null;
  }
}
