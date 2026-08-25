import { verifyMetaSignature } from "@/lib/instagram";

// Facebook Messenger (Page) send + helpers. Unlike Instagram (graph.instagram.com),
// Messenger uses graph.facebook.com with a Page access token and a recipient PSID.
// Dormant until PAGE_ACCESS_TOKEN is set. Signature verification reuses the shared
// META_APP_SECRET check from instagram.ts.

const GRAPH = "https://graph.facebook.com/v21.0";

export function isMessengerConfigured(): boolean {
  return !!process.env.PAGE_ACCESS_TOKEN;
}
export function messengerVerifyToken(): string | undefined {
  return process.env.MESSENGER_VERIFY_TOKEN || process.env.IG_VERIFY_TOKEN || undefined;
}
export { verifyMetaSignature };

/** Send a Messenger message to a user PSID within the Page's messaging window. */
export async function sendMessengerMessage(
  { psid, text, tag }: { psid: string; text: string; tag?: string },
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const token = process.env.PAGE_ACCESS_TOKEN;
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
  const token = process.env.PAGE_ACCESS_TOKEN;
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
