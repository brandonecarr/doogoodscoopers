import prisma from "@/lib/prisma";

/**
 * Google Business Profile integration — OAuth + pulling reviews.
 *
 * Setup (one-time, by the business owner):
 *  1. Google Cloud project → enable "Google Business Profile API",
 *     "My Business Account Management API", "My Business Business Information API".
 *  2. Request Business Profile API access (allowlist form) — the reviews
 *     endpoints 403 until Google approves the project.
 *  3. OAuth consent screen + OAuth client (Web). Authorized redirect URI =
 *     <your-domain>/api/admin/google/oauth/callback  (or GOOGLE_OAUTH_REDIRECT_URI).
 *  4. Set env: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET.
 *  5. Click "Connect" in /admin/reviews → authorize → we store a refresh token.
 *
 * Secrets: client id/secret come from env; the refresh token is stored in
 * AppSetting (server-only, never returned to the browser).
 */

const SCOPE = "https://www.googleapis.com/auth/business.manage";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ACCOUNTS_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";
const BUSINESS_INFO_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";
const V4_BASE = "https://mybusiness.googleapis.com/v4";

const STAR_MAP: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
export const starToNumber = (s: string | undefined | null) => (s ? STAR_MAP[s] ?? null : null);

export function googleOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

function redirectUri(origin: string): string {
  return process.env.GOOGLE_OAUTH_REDIRECT_URI || `${origin}/api/admin/google/oauth/callback`;
}

// ── Settings helpers (AppSetting key/value) ─────────────────────────────────
export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}
export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

// ── OAuth ────────────────────────────────────────────────────────────────────
export function buildAuthUrl(origin: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: `${SCOPE} openid email`,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

/** The email of the Google account that authorized (for display). */
export async function getUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const j = await res.json();
  return j.email || null;
}

export async function exchangeCodeForTokens(code: string, origin: string): Promise<{ refresh_token?: string; access_token: string }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text().catch(() => "")}`);
  return res.json();
}

/** Get a fresh access token from the stored refresh token. */
export async function getAccessToken(): Promise<string> {
  const refresh = await getSetting("google.oauth.refreshToken");
  if (!refresh) throw new Error("Not connected to Google Business Profile");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Refresh failed: ${res.status} ${await res.text().catch(() => "")}`);
  const json = await res.json();
  return json.access_token as string;
}

async function gfetch(url: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google API ${res.status} on ${url.replace(/https:\/\/[^/]+/, "")}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// ── Accounts / locations ─────────────────────────────────────────────────────
export interface GAccount { name: string; accountName?: string }
export interface GLocation { name: string; title?: string }

export async function listAccounts(accessToken: string): Promise<GAccount[]> {
  const json = await gfetch(ACCOUNTS_URL, accessToken);
  return json.accounts || [];
}
export async function listLocations(accountName: string, accessToken: string): Promise<GLocation[]> {
  // accountName = "accounts/123"
  const json = await gfetch(`${BUSINESS_INFO_BASE}/${accountName}/locations?readMask=name,title&pageSize=100`, accessToken);
  return json.locations || [];
}

// ── Reviews ──────────────────────────────────────────────────────────────────
export interface GReview {
  reviewId: string;
  reviewer?: { displayName?: string };
  starRating?: string; // ONE..FIVE
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: { comment?: string; updateTime?: string };
}

/** Fetch every review for a location (paginated). accountId/locationId are numeric ids. */
export async function fetchAllReviews(accessToken: string, accountId: string, locationId: string): Promise<{ reviews: GReview[]; averageRating?: number; totalReviewCount?: number }> {
  const all: GReview[] = [];
  let pageToken: string | undefined;
  let averageRating: number | undefined;
  let totalReviewCount: number | undefined;
  do {
    const p = new URLSearchParams({ pageSize: "50" });
    if (pageToken) p.set("pageToken", pageToken);
    const json = await gfetch(`${V4_BASE}/accounts/${accountId}/locations/${locationId}/reviews?${p}`, accessToken);
    for (const r of json.reviews || []) all.push(r);
    averageRating = json.averageRating ?? averageRating;
    totalReviewCount = json.totalReviewCount ?? totalReviewCount;
    pageToken = json.nextPageToken;
  } while (pageToken && all.length < 2000);
  return { reviews: all, averageRating, totalReviewCount };
}

/** Post/update our reply to a review. */
export async function replyToReview(accessToken: string, accountId: string, locationId: string, reviewId: string, comment: string): Promise<void> {
  await gfetch(`${V4_BASE}/accounts/${accountId}/locations/${locationId}/reviews/${reviewId}/reply`, accessToken, {
    method: "PUT",
    body: JSON.stringify({ comment }),
  });
}

/** Strip the "accounts/" or "locations/" prefix to get the numeric id. */
export const idFromName = (name: string) => name.split("/").pop() || name;
