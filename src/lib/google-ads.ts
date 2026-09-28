// ── Google Ads API client (credential-gated) ────────────────────────────────────
// Pulls REAL keyword data — search volume / competition / top-of-page bids from
// Keyword Planner, and the account's own search-terms report — to enrich the
// Keyword Radar report. Everything here no-ops gracefully until these env vars
// are set in Vercel, so the AI-only report keeps working without it:
//
//   GOOGLE_ADS_DEVELOPER_TOKEN     — from your Google Ads manager (MCC) account
//   GOOGLE_ADS_CLIENT_ID           — OAuth2 client id
//   GOOGLE_ADS_CLIENT_SECRET       — OAuth2 client secret
//   GOOGLE_ADS_REFRESH_TOKEN       — OAuth2 refresh token for your Ads login
//   GOOGLE_ADS_CUSTOMER_ID         — the ad account id (digits only, no dashes)
//   GOOGLE_ADS_LOGIN_CUSTOMER_ID   — (optional) MCC id if the above is under a manager
//   GOOGLE_ADS_API_VERSION         — (optional) pin the API version; auto-detected otherwise
//   GOOGLE_ADS_GEO_TARGETS         — (optional) geoTargetConstant ids, comma-separated
//                                     (default 21137 = California). US = 2840.

// The Google Ads API is versioned in the URL (e.g. /v21/) and Google retires old
// versions on a rolling basis, so a hardcoded version eventually 404s. We detect
// the newest version this account accepts once and cache it. GOOGLE_ADS_API_VERSION
// pins it explicitly if ever needed.
const CANDIDATE_VERSIONS = ["v24", "v23", "v22", "v21", "v20", "v19", "v18", "v17"];
const HOST = "https://googleads.googleapis.com";
let resolvedVersion: string | null = null;

/** Resolve the API base URL, probing for a live version (cached) when not pinned. */
async function resolveBase(token: string, customerId: string): Promise<string> {
  const pinned = process.env.GOOGLE_ADS_API_VERSION;
  if (pinned) return `${HOST}/${pinned}`;
  if (resolvedVersion) return `${HOST}/${resolvedVersion}`;
  const body = JSON.stringify({ keywordSeed: { keywords: ["dog waste removal"] }, keywordPlanNetwork: "GOOGLE_SEARCH", language: "languageConstants/1000" });
  for (const v of CANDIDATE_VERSIONS) {
    try {
      const res = await fetch(`${HOST}/${v}/customers/${customerId}:generateKeywordIdeas`, { method: "POST", headers: headers(token), body, cache: "no-store" });
      if (res.status !== 404) { resolvedVersion = v; return `${HOST}/${v}`; }
    } catch { /* try next */ }
  }
  return `${HOST}/${CANDIDATE_VERSIONS[CANDIDATE_VERSIONS.length - 1]}`;
}

export interface KeywordMetric {
  text: string;
  avgMonthlySearches: number | null;
  competition: string | null;        // LOW | MEDIUM | HIGH | UNKNOWN
  lowTopBid: number | null;          // dollars
  highTopBid: number | null;         // dollars
}
export interface SearchTermRow {
  term: string;
  impressions: number;
  clicks: number;
  conversions: number;
}

export function isGoogleAdsConfigured(): boolean {
  // Google is migrating off developer tokens (sunset 2026-09-09) to project-based
  // access, so the developer token is OPTIONAL here — we require only the OAuth
  // credentials + the ad account id, and send the developer-token header if it's
  // still set. If Google rejects a call for a missing token, the error says so.
  return !!(
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN &&
    process.env.GOOGLE_ADS_CUSTOMER_ID
  );
}

const digits = (s: string | undefined) => (s || "").replace(/\D/g, "");
const microsToDollars = (m: string | number | null | undefined) =>
  m == null ? null : Math.round((Number(m) / 1_000_000) * 100) / 100;

async function accessToken(): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
        refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[google-ads] token exchange failed:", res.status, (await res.text().catch(() => "")).slice(0, 200));
      return null;
    }
    const j = await res.json();
    return j.access_token || null;
  } catch (e) {
    console.error("[google-ads] token error:", e instanceof Error ? e.message : e);
    return null;
  }
}

function headers(token: string, opts?: { omitLogin?: boolean }): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  // Developer token is optional under the new project-based access model.
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (devToken) h["developer-token"] = devToken;
  if (!opts?.omitLogin) {
    const login = digits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
    if (login) h["login-customer-id"] = login;
  }
  return h;
}

// The ad account may be reachable directly (owner access) rather than through the
// manager. If a call is denied with the manager's login-customer-id set, retry
// once without it (direct access). Caches which mode works.
let omitLoginPreferred = false;
async function fetchAds(url: string, token: string, body: string): Promise<Response> {
  const hasLogin = !!digits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  const first = await fetch(url, { method: "POST", headers: headers(token, { omitLogin: omitLoginPreferred }), body, cache: "no-store" });
  if (first.status === 403 && hasLogin && !omitLoginPreferred) {
    const second = await fetch(url, { method: "POST", headers: headers(token, { omitLogin: true }), body, cache: "no-store" });
    if (second.status !== 403) { omitLoginPreferred = true; return second; }
  }
  return first;
}

/**
 * Live diagnostic — surfaces the exact HTTP status / error body from a real
 * Keyword Planner call so we can see WHY enrichment is (or isn't) working
 * (wrong access level, wrong API version, geo, etc.). Session-gated route only.
 */
export async function googleAdsDiagnostic(): Promise<Record<string, unknown>> {
  if (!isGoogleAdsConfigured()) return { configured: false, hint: "OAuth env vars missing (CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN / CUSTOMER_ID)." };
  const token = await accessToken();
  if (!token) return { configured: true, tokenOk: false, error: "OAuth token exchange failed — check CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN." };
  const customerId = digits(process.env.GOOGLE_ADS_CUSTOMER_ID);
  const geos = (process.env.GOOGLE_ADS_GEO_TARGETS || "21137").split(",").map((s) => s.trim()).filter(Boolean).map((id) => `geoTargetConstants/${id}`);
  const base = await resolveBase(token, customerId);
  const url = `${base}/customers/${customerId}:generateKeywordIdeas`;
  const body = JSON.stringify({ keywordSeed: { keywords: ["pooper scooper service"] }, geoTargetConstants: geos, language: "languageConstants/1000", keywordPlanNetwork: "GOOGLE_SEARCH" });
  const attempt = async (omitLogin: boolean) => {
    try {
      const res = await fetch(url, { method: "POST", headers: headers(token, { omitLogin }), body, cache: "no-store" });
      const txt = await res.text().catch(() => "");
      let ideaCount = 0;
      try { ideaCount = (JSON.parse(txt).results || []).length; } catch { /* ignore */ }
      return { status: res.status, ok: res.ok, ideaCount, error: res.ok ? null : txt.slice(0, 600) };
    } catch (e) {
      return { status: 0, ok: false, ideaCount: 0, error: e instanceof Error ? e.message : String(e) };
    }
  };
  const withManager = await attempt(false);
  const direct = digits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) ? await attempt(true) : null;
  const working = withManager.ok ? "with login-customer-id" : direct?.ok ? "direct (no login-customer-id)" : "neither";
  return {
    configured: true, tokenOk: true,
    apiVersion: resolvedVersion || process.env.GOOGLE_ADS_API_VERSION || "auto",
    customerId, loginCustomerId: digits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) || null,
    hasDeveloperToken: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    working, withManager, direct,
  };
}

/** Keyword Planner ideas + metrics for a set of seed keywords. */
export async function generateKeywordIdeas(seeds: string[]): Promise<KeywordMetric[]> {
  if (!isGoogleAdsConfigured() || !seeds.length) return [];
  const token = await accessToken();
  if (!token) return [];
  const customerId = digits(process.env.GOOGLE_ADS_CUSTOMER_ID);
  const geos = (process.env.GOOGLE_ADS_GEO_TARGETS || "21137")
    .split(",").map((s) => s.trim()).filter(Boolean)
    .map((id) => `geoTargetConstants/${id}`);
  const base = await resolveBase(token, customerId);

  try {
    const res = await fetchAds(`${base}/customers/${customerId}:generateKeywordIdeas`, token, JSON.stringify({
      keywordSeed: { keywords: seeds.slice(0, 20) },
      geoTargetConstants: geos,
      language: "languageConstants/1000", // English
      keywordPlanNetwork: "GOOGLE_SEARCH",
      includeAdultKeywords: false,
    }));
    if (!res.ok) {
      console.error("[google-ads] generateKeywordIdeas failed:", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return [];
    }
    const j = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (j.results || []).map((r: any): KeywordMetric => ({
      text: String(r.text || ""),
      avgMonthlySearches: r.keywordIdeaMetrics?.avgMonthlySearches != null ? Number(r.keywordIdeaMetrics.avgMonthlySearches) : null,
      competition: r.keywordIdeaMetrics?.competition ?? null,
      lowTopBid: microsToDollars(r.keywordIdeaMetrics?.lowTopOfPageBidMicros),
      highTopBid: microsToDollars(r.keywordIdeaMetrics?.highTopOfPageBidMicros),
    })).filter((k: KeywordMetric) => k.text);
  } catch (e) {
    console.error("[google-ads] generateKeywordIdeas error:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** The account's own search terms over the last `days` days (what actually triggered your ads). */
export async function getSearchTerms(days = 30): Promise<SearchTermRow[]> {
  if (!isGoogleAdsConfigured()) return [];
  const token = await accessToken();
  if (!token) return [];
  const customerId = digits(process.env.GOOGLE_ADS_CUSTOMER_ID);
  const query = `
    SELECT search_term_view.search_term, metrics.impressions, metrics.clicks, metrics.conversions
    FROM search_term_view
    WHERE segments.date DURING LAST_${days === 7 ? "7" : "30"}_DAYS
    ORDER BY metrics.impressions DESC
    LIMIT 100`;
  const base = await resolveBase(token, customerId);
  try {
    const res = await fetchAds(`${base}/customers/${customerId}/googleAds:searchStream`, token, JSON.stringify({ query }));
    if (!res.ok) {
      console.error("[google-ads] searchStream failed:", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return [];
    }
    const j = await res.json();
    const rows: SearchTermRow[] = [];
    // searchStream returns an array of {results:[...]} chunks.
    const chunks = Array.isArray(j) ? j : [j];
    for (const chunk of chunks) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of (chunk.results || []) as any[]) {
        const term = r.searchTermView?.searchTerm || r.search_term_view?.search_term;
        if (!term) continue;
        rows.push({
          term: String(term),
          impressions: Number(r.metrics?.impressions ?? 0),
          clicks: Number(r.metrics?.clicks ?? 0),
          conversions: Number(r.metrics?.conversions ?? 0),
        });
      }
    }
    return rows;
  } catch (e) {
    console.error("[google-ads] searchStream error:", e instanceof Error ? e.message : e);
    return [];
  }
}
