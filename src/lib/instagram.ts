import crypto from "crypto";

/**
 * Instagram comment → auto-DM automation (a native, cron-driven take on
 * OpenReply / ManyChat's comment growth tool).
 *
 * Flow: Meta sends a webhook when someone comments on the connected IG Business
 * account → we match the text against active keyword campaigns → queue an
 * InstagramDm → the process-instagram-dms cron drains the queue and sends a
 * private reply (a DM tied to that comment) via the Graph API, rate-limited.
 *
 * Env (owner sets these; inert until present):
 *   IG_VERIFY_TOKEN  – any string you choose; must match the Meta webhook config
 *   IG_PAGE_TOKEN    – access token for the connected IG Business account / Page
 *   IG_ACCOUNT_ID    – the Instagram Business account id (IG user id)
 *   META_APP_SECRET  – app secret, for verifying webhook signatures
 */

// Instagram API with Instagram Login uses Instagram's own Graph host — tokens
// begin with "IGAA" and are rejected ("Cannot parse access token") by
// graph.facebook.com, which only accepts Facebook/Page (EAA…) tokens.
const GRAPH = "https://graph.instagram.com/v21.0";

export function isInstagramConfigured(): boolean {
  return !!(process.env.IG_PAGE_TOKEN && process.env.IG_VERIFY_TOKEN && process.env.IG_ACCOUNT_ID);
}

/** Verify Meta's X-Hub-Signature-256 header against the raw request body. */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return false;
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice("sha256=".length);
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

/** Does a comment trigger a campaign? Case-insensitive; whole-word or substring. */
export function matchesKeywords(commentText: string, keywords: string[], matchType: string): boolean {
  const text = (commentText || "").toLowerCase();
  if (!text) return false;
  return keywords.some((kw) => {
    const k = kw.trim().toLowerCase();
    if (!k) return false;
    if (matchType === "whole") {
      return new RegExp(`(^|[^a-z0-9])${escapeRegExp(k)}([^a-z0-9]|$)`, "i").test(text);
    }
    return text.includes(k);
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Fill {username} (and a couple of aliases) in the DM template. */
export function renderDm(template: string, vars: { username?: string | null }): string {
  const name = vars.username ? `@${vars.username}` : "there";
  return template.replace(/\{username\}/gi, name).replace(/\{name\}/gi, vars.username || "there");
}

/**
 * Send a private reply (DM) tied to a comment, via the connected IG account.
 * Meta allows this within 7 days of the comment.
 */
export async function sendPrivateReply(commentId: string, text: string): Promise<{ ok: boolean; error?: string; rateLimited?: boolean }> {
  const token = process.env.IG_PAGE_TOKEN;
  const accountId = process.env.IG_ACCOUNT_ID;
  if (!token || !accountId) return { ok: false, error: "Instagram not configured" };
  try {
    const res = await fetch(`${GRAPH}/${encodeURIComponent(accountId)}/messages?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true };
    const err = d?.error;
    const rateLimited = err?.code === 613 || err?.code === 4 || /rate|limit|too many/i.test(err?.message || "");
    return { ok: false, error: err?.message || `Graph error ${res.status}`, rateLimited };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** Post a public reply to a comment (optional). */
export async function replyToComment(commentId: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.IG_PAGE_TOKEN;
  if (!token) return { ok: false, error: "Instagram not configured" };
  try {
    const res = await fetch(`${GRAPH}/${encodeURIComponent(commentId)}/replies?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: d?.error?.message || `Graph error ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "reply failed" };
  }
}
