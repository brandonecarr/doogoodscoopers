import crypto from "crypto";

/**
 * Facebook Messenger (Meta Messenger Platform) helpers.
 *
 * Setup (owner does this on Meta's side):
 *  1. Create a Meta app → add the "Messenger" product → connect the Facebook Page.
 *  2. Generate a Page access token → set MESSENGER_PAGE_TOKEN.
 *  3. Set a Webhook: callback URL = https://<site>/api/webhooks/messenger,
 *     verify token = MESSENGER_VERIFY_TOKEN, subscribe to the "messages" field.
 *  4. Set META_APP_SECRET (App Settings → Basic) so we can verify signatures.
 * Everything here no-ops until MESSENGER_PAGE_TOKEN + MESSENGER_VERIFY_TOKEN exist.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export function isMessengerConfigured(): boolean {
  return !!(process.env.MESSENGER_PAGE_TOKEN && process.env.MESSENGER_VERIFY_TOKEN);
}

/** Verify Meta's X-Hub-Signature-256 header against the raw request body. */
export function verifyMessengerSignature(rawBody: string, signatureHeader: string | null): boolean {
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

export interface MessengerProfile {
  firstName?: string;
  lastName?: string;
  name?: string;
  profilePicUrl?: string;
}

/** Look up a messaging user's public profile (name + picture) via the Graph API. */
export async function fetchMessengerProfile(psid: string): Promise<MessengerProfile> {
  const token = process.env.MESSENGER_PAGE_TOKEN;
  if (!token) return {};
  try {
    const url = `${GRAPH}/${encodeURIComponent(psid)}?fields=first_name,last_name,profile_pic&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    if (!res.ok) return {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = await res.json().catch(() => ({}));
    const firstName = d.first_name || undefined;
    const lastName = d.last_name || undefined;
    return {
      firstName,
      lastName,
      name: [firstName, lastName].filter(Boolean).join(" ") || undefined,
      profilePicUrl: d.profile_pic || undefined,
    };
  } catch {
    return {};
  }
}

/** Send a text reply back to a Messenger user (Send API). Used by the reply feature. */
export async function sendMessengerMessage(psid: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.MESSENGER_PAGE_TOKEN;
  if (!token) return { ok: false, error: "Messenger is not configured" };
  try {
    const res = await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipient: { id: psid }, messaging_type: "RESPONSE", message: { text } }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: d?.error?.message || `Graph error ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
