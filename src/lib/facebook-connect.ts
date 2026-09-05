import { getSetting, setSetting } from "@/lib/google-business";

/**
 * "Connect Facebook Page" — Facebook Login in the admin, so the Page access
 * token comes from the owner granting pages_show_list / pages_messaging /
 * pages_manage_metadata in a visible login flow (what Meta's App Review needs
 * to see), rather than from a token pasted into an environment variable.
 *
 * Tokens live in AppSetting under facebook.*. PAGE_ACCESS_TOKEN in the
 * environment is still honoured as a fallback so nothing breaks before the
 * first connect.
 */
const GRAPH = "https://graph.facebook.com/v21.0";
// pages_read_engagement is what lets the app read the Page object and mint its
// token — without it Facebook answers "(#100) Object does not exist … requires
// the 'pages_read_engagement' permission" even with the other three granted.
export const FB_SCOPES = ["pages_show_list", "pages_messaging", "pages_manage_metadata", "pages_read_engagement"];
/** App ID of "DooGoodScoopers PM System" (public; the secret stays in FB_APP_SECRET). */
export const fbAppId = () => process.env.FB_APP_ID || "3321005114736574";
export const fbConfigured = () => !!process.env.FB_APP_SECRET;
export const fbRedirectUri = (origin: string) => `${origin}/api/admin/facebook/callback`;

export interface FbPage { id: string; name: string; access_token: string; picture?: string; category?: string }

/**
 * Login dialog URL. A Business-type app must use a Facebook Login for Business
 * configuration (config_id) instead of a scope list; when one is saved it wins.
 */
export async function buildFbAuthUrl(origin: string, state: string): Promise<string> {
  const configId = (await getSetting("facebook.loginConfigId")) || "";
  const p = new URLSearchParams({ client_id: fbAppId(), redirect_uri: fbRedirectUri(origin), state, response_type: "code" });
  if (configId) { p.set("config_id", configId); p.set("override_default_response_type", "true"); }
  else p.set("scope", FB_SCOPES.join(","));
  return `https://www.facebook.com/v21.0/dialog/oauth?${p}`;
}

type GraphErr = { error?: { message?: string; code?: number } };
async function graph<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GRAPH}/${path}`, { ...init, cache: "no-store" });
  const j = (await res.json().catch(() => ({}))) as T & GraphErr;
  if (!res.ok || j.error) throw new Error(j.error?.message || `Graph error ${res.status}`);
  return j;
}

/** code → short-lived user token → long-lived user token (~60 days). */
export async function exchangeFbCode(code: string, origin: string): Promise<string> {
  const q = new URLSearchParams({ client_id: fbAppId(), client_secret: process.env.FB_APP_SECRET || "", redirect_uri: fbRedirectUri(origin), code });
  const short = await graph<{ access_token: string }>(`oauth/access_token?${q}`);
  const q2 = new URLSearchParams({ grant_type: "fb_exchange_token", client_id: fbAppId(), client_secret: process.env.FB_APP_SECRET || "", fb_exchange_token: short.access_token });
  const long = await graph<{ access_token: string }>(`oauth/access_token?${q2}`).catch(() => short);
  return long.access_token;
}

export async function fbUserName(userToken: string): Promise<string> {
  const me = await graph<{ name?: string }>(`me?fields=name&access_token=${encodeURIComponent(userToken)}`);
  return me.name || "";
}

/**
 * Pages the user manages (pages_show_list). Page tokens minted from a long-lived
 * user token don't expire. When /me/accounts comes back empty even though the
 * grant names specific Pages, each of those is fetched directly by ID — that
 * works in cases where the listing doesn't. Facebook's own error text is kept
 * so the card can show it.
 */
export async function listFbPages(userToken: string): Promise<FbPage[]> {
  const r = await listFbPagesDetailed(userToken);
  return r.pages;
}
export async function listFbPagesDetailed(userToken: string): Promise<{ pages: FbPage[]; errors: string[] }> {
  const fields = "id,name,access_token,category,picture{url}";
  const errors: string[] = [];
  type Raw = { id: string; name: string; access_token?: string; category?: string; picture?: { data?: { url?: string } } };
  const toPage = (p: Raw): FbPage => ({ id: p.id, name: p.name, access_token: p.access_token || "", category: p.category, picture: p.picture?.data?.url });
  let pages: FbPage[] = [];
  try {
    const r = await graph<{ data?: Raw[] }>(`me/accounts?fields=${fields}&limit=100&access_token=${encodeURIComponent(userToken)}`);
    pages = (r.data || []).map(toPage);
  } catch (e) { errors.push(`me/accounts: ${e instanceof Error ? e.message : "failed"}`); }
  if (pages.length === 0) {
    const granular = await fbGranularPages(userToken).catch(() => []);
    const ids = new Set(granular.flatMap((g) => g.targetIds || []));
    for (const id of ids) {
      try {
        const p = await graph<Raw>(`${id}?fields=${fields}&access_token=${encodeURIComponent(userToken)}`);
        if (p.access_token) pages.push(toPage(p)); else errors.push(`Page ${id} (${p.name}): Facebook returned the Page but no access token — this profile has no admin role on it`);
      } catch (e) { errors.push(`Page ${id}: ${e instanceof Error ? e.message : "failed"}`); }
    }
  }
  return { pages, errors };
}

export interface FbPermissions { granted: string[]; declined: string[] }
/** What the user token actually carries (me/permissions). */
export async function fbPermissions(userToken: string): Promise<FbPermissions> {
  const r = await graph<{ data?: { permission: string; status: string }[] }>(`me/permissions?access_token=${encodeURIComponent(userToken)}`);
  const rows = r.data || [];
  return { granted: rows.filter((x) => x.status === "granted").map((x) => x.permission), declined: rows.filter((x) => x.status !== "granted").map((x) => x.permission) };
}

/**
 * Which Pages the granted permissions actually cover, from Facebook's token
 * debugger (needs the app token). `target_ids` absent = every Page the user
 * has a role on; present = only those Pages; an empty list = none chosen.
 */
export async function fbGranularPages(userToken: string): Promise<{ scope: string; targetIds: string[] | null }[]> {
  const appToken = `${fbAppId()}|${process.env.FB_APP_SECRET || ""}`;
  const r = await graph<{ data?: { granular_scopes?: { scope: string; target_ids?: string[] }[] } }>(
    `debug_token?input_token=${encodeURIComponent(userToken)}&access_token=${encodeURIComponent(appToken)}`);
  return (r.data?.granular_scopes || []).map((g) => ({ scope: g.scope, targetIds: g.target_ids ?? null }));
}

/** Subscribe the app to the Page's Messenger webhooks (pages_manage_metadata). */
export async function subscribePageWebhooks(pageId: string, pageToken: string): Promise<string[]> {
  const fields = ["messages", "messaging_postbacks", "messaging_optins", "messaging_referrals"];
  await graph(`${pageId}/subscribed_apps?subscribed_fields=${fields.join(",")}&access_token=${encodeURIComponent(pageToken)}`, { method: "POST" });
  return fields;
}

/** The token the Messenger sender should use: connected Page first, env fallback. */
export async function getPageAccessToken(): Promise<string | null> {
  return (await getSetting("facebook.pageToken")) || process.env.PAGE_ACCESS_TOKEN || null;
}

export interface FbConnection {
  configured: boolean; connected: boolean; usingEnvToken: boolean;
  pageId: string | null; pageName: string | null; pagePicture: string | null;
  userName: string | null; connectedAt: string | null; webhookFields: string | null;
  pendingPages: FbPage[]; loginConfigId: string;
  /** Live check of the last Facebook login's token; null when nobody has logged in. */
  permissions: FbPermissions | null;
  /** Page IDs the pages_show_list grant covers: null = all Pages the profile has a role on; [] = none. */
  pageScope: string[] | null;
}

export async function getFbConnection(): Promise<FbConnection> {
  const [pageToken, pageId, pageName, pagePicture, userName, connectedAt, webhookFields, pending, loginConfigId, userToken] = await Promise.all([
    getSetting("facebook.pageToken"), getSetting("facebook.pageId"), getSetting("facebook.pageName"), getSetting("facebook.pagePicture"),
    getSetting("facebook.userName"), getSetting("facebook.connectedAt"), getSetting("facebook.webhookFields"), getSetting("facebook.pendingPages"), getSetting("facebook.loginConfigId"),
    getSetting("facebook.userToken"),
  ]);
  const permissions = userToken ? await fbPermissions(userToken).catch(() => null) : null;
  const granular = userToken ? await fbGranularPages(userToken).catch(() => []) : [];
  const pageScope = granular.find((g) => g.scope === "pages_show_list")?.targetIds ?? null;
  let pendingPages: FbPage[] = [];
  try { pendingPages = pending ? (JSON.parse(pending) as FbPage[]).map((p) => ({ ...p, access_token: "" })) : []; } catch { pendingPages = []; }
  return {
    configured: fbConfigured(), connected: !!pageToken, usingEnvToken: !pageToken && !!process.env.PAGE_ACCESS_TOKEN,
    pageId: pageId || null, pageName: pageName || null, pagePicture: pagePicture || null, userName: userName || null,
    connectedAt: connectedAt || null, webhookFields: webhookFields || null, pendingPages, loginConfigId: loginConfigId || "", permissions, pageScope,
  };
}

export async function clearFbConnection(): Promise<void> {
  for (const k of ["facebook.pageToken", "facebook.pageId", "facebook.pageName", "facebook.pagePicture", "facebook.userToken", "facebook.userName", "facebook.connectedAt", "facebook.webhookFields", "facebook.pendingPages"]) {
    await setSetting(k, "");
  }
}
