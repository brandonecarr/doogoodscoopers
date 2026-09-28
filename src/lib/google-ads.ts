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
//   GOOGLE_ADS_API_VERSION         — (optional) defaults to v21
//   GOOGLE_ADS_GEO_TARGETS         — (optional) geoTargetConstant ids, comma-separated
//                                     (default 21137 = California). US = 2840.

const V = process.env.GOOGLE_ADS_API_VERSION || "v21";
const BASE = `https://googleads.googleapis.com/${V}`;

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

function headers(token: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  // Developer token is optional under the new project-based access model.
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (devToken) h["developer-token"] = devToken;
  const login = digits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  if (login) h["login-customer-id"] = login;
  return h;
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

  try {
    const res = await fetch(`${BASE}/customers/${customerId}:generateKeywordIdeas`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        keywordSeed: { keywords: seeds.slice(0, 20) },
        geoTargetConstants: geos,
        language: "languageConstants/1000", // English
        keywordPlanNetwork: "GOOGLE_SEARCH",
        includeAdultKeywords: false,
      }),
      cache: "no-store",
    });
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
  try {
    const res = await fetch(`${BASE}/customers/${customerId}/googleAds:searchStream`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ query }),
      cache: "no-store",
    });
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
