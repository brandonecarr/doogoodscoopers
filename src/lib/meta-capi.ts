import crypto from "crypto";

// Server-side Meta Conversions API (CAPI). Fires a "Lead" event to the Graph API
// with hashed PII + fbp/fbc + a shared event_id so it dedups with the browser
// pixel's Lead event. No-ops unless META_PIXEL_ID + META_CAPI_ACCESS_TOKEN are set.

const GRAPH_VERSION = "v21.0";

export function isMetaCapiConfigured(): boolean {
  return !!(process.env.META_PIXEL_ID && process.env.META_CAPI_ACCESS_TOKEN);
}

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const hashField = (v: string | null | undefined): string[] | undefined => {
  const s = (v || "").trim().toLowerCase();
  return s ? [sha256(s)] : undefined;
};
const hashPhone = (v: string | null | undefined): string[] | undefined => {
  let d = (v || "").replace(/\D/g, "");
  if (!d) return undefined;
  if (d.length === 10) d = `1${d}`; // US default, no leading +
  return [sha256(d)];
};

export interface LeadEventInput {
  eventId: string;
  eventSourceUrl?: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  zip?: string | null;
  city?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  value?: number | null;
  currency?: string;
  testEventCode?: string;
}

/** Send a Lead event to Meta CAPI. Fire-and-forget; returns { ok } / { error }. */
export async function sendLeadEvent(input: LeadEventInput): Promise<{ ok: boolean; error?: string }> {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) return { ok: false, error: "Meta CAPI not configured" };

  const userData: Record<string, unknown> = {};
  const em = hashField(input.email); if (em) userData.em = em;
  const ph = hashPhone(input.phone); if (ph) userData.ph = ph;
  const fn = hashField(input.firstName); if (fn) userData.fn = fn;
  const ln = hashField(input.lastName); if (ln) userData.ln = ln;
  const zp = hashField(input.zip); if (zp) userData.zp = zp;
  const ct = hashField(input.city); if (ct) userData.ct = ct;
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;
  if (input.clientIp) userData.client_ip_address = input.clientIp;
  if (input.userAgent) userData.client_user_agent = input.userAgent;

  const customData: Record<string, unknown> = { currency: input.currency || "USD" };
  if (typeof input.value === "number" && input.value > 0) customData.value = input.value;

  const payload = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        ...(input.eventSourceUrl ? { event_source_url: input.eventSourceUrl } : {}),
        user_data: userData,
        custom_data: customData,
      },
    ],
    ...(input.testEventCode || process.env.META_CAPI_TEST_EVENT_CODE
      ? { test_event_code: input.testEventCode || process.env.META_CAPI_TEST_EVENT_CODE }
      : {}),
  };

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("[meta-capi] Lead failed:", res.status, t.slice(0, 300));
      return { ok: false, error: `Meta ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[meta-capi] Lead error:", e instanceof Error ? e.message : e);
    return { ok: false, error: "network" };
  }
}
