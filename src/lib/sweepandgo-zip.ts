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
