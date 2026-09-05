import crypto from "crypto";
import { verifyMetaSignature } from "@/lib/instagram";
import { getPageAccessToken } from "@/lib/facebook-connect";

// Facebook Messenger (Page) send + helpers. Unlike Instagram (graph.instagram.com),
// Messenger uses graph.facebook.com with a Page access token and a recipient PSID.
// The Page token comes from the "Connect Facebook Page" login flow (AppSetting
// facebook.pageToken), with PAGE_ACCESS_TOKEN in the environment as a fallback.
// Signature verification reuses the shared META_APP_SECRET check from instagram.ts.

const GRAPH = "https://graph.facebook.com/v21.0";

export async function isMessengerConfigured(): Promise<boolean> {
  return !!(await getPageAccessToken());
}
export function messengerVerifyToken(): string | undefined {
  return process.env.MESSENGER_VERIFY_TOKEN || process.env.IG_VERIFY_TOKEN || undefined;
}
export { verifyMetaSignature };

// Facebook Messenger webhooks are signed with the FACEBOOK App Secret, which for
// this app differs from the Instagram app secret (META_APP_SECRET). Accept either
// so we don't reject genuine events regardless of which secret is configured.
export function verifyMessengerSignature(raw: string, sig: string | null): boolean {
  if (!sig) return false;
  const secrets = [process.env.FB_APP_SECRET, process.env.META_APP_SECRET].filter(Boolean) as string[];
  for (const secret of secrets) {
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw, "utf8").digest("hex");
    try {
      if (sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return true;
    } catch { /* length mismatch → next secret */ }
  }
  return false;
}
export function hasMessengerSecret(): boolean {
  return !!(process.env.FB_APP_SECRET || process.env.META_APP_SECRET);
}

/** Send a Messenger message to a user PSID within the Page's messaging window. */
export async function sendMessengerMessage(
  { psid, text, tag }: { psid: string; text: string; tag?: string },
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const token = await getPageAccessToken();
  if (!token) return { ok: false, error: "Messenger not configured" };
  try {
    const res = await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: psid },
        // RESPONSE = replying inside the standard 24h window; MESSAGE_TAG (+tag)
        // for the human-agent 7-day window when we pass one.
        messaging_type: tag ? "MESSAGE_TAG" : "RESPONSE",
        ...(tag ? { tag } : {}),
        message: { text },
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { message_id?: string; error?: { message?: string } };
    if (!res.ok || data.error) return { ok: false, error: data.error?.message || `Messenger error ${res.status}` };
    return { ok: true, messageId: data.message_id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** Read a Messenger user's name from their PSID (needs Business Asset User Profile
 *  Access). Used to auto-link a thread to the AdLead by name. */
export async function getMessengerProfile(psid: string): Promise<{ firstName?: string; lastName?: string; name?: string } | null> {
  const token = await getPageAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${GRAPH}/${encodeURIComponent(psid)}?fields=first_name,last_name&access_token=${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    const d = (await res.json()) as { first_name?: string; last_name?: string };
    const name = [d.first_name, d.last_name].filter(Boolean).join(" ").trim() || undefined;
    return { firstName: d.first_name, lastName: d.last_name, name };
  } catch {
    return null;
  }
}
