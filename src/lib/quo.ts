/**
 * Quo integration (https://api.quo.com/v1)
 *
 * Quo is the business phone/SMS platform that replaces Twilio as the sole SMS
 * provider. This module mirrors the old `twilio.ts` contract (`sendSms`,
 * `normalizePhoneNumber`, `SendSmsOptions`, `SendSmsResult`) so existing call
 * sites don't change, and adds the helpers used by the Quo webhook and contact
 * sync.
 *
 * Auth: `Authorization: <API_KEY>` — a RAW key, NOT a Bearer token.
 * Delivery status: Quo has no Twilio-style statusCallback; status arrives via
 * the `message.delivered` / `message.failed` webhook.
 */

import crypto from "crypto";

const QUO_BASE_URL = "https://api.quo.com/v1";

const apiKey = process.env.QUO_API_KEY;
const fromNumber = process.env.QUO_PHONE_NUMBER;
const defaultUserId = process.env.QUO_DEFAULT_USER_ID;

export function isQuoConfigured(): boolean {
  return !!(apiKey && fromNumber);
}

/** Our Quo sending number (E.164) — used as `participant_our` on conversations. */
export function getQuoFromNumber(): string {
  return fromNumber || "";
}

// ── Shared SMS contract (identical to the old twilio.ts so call sites are drop-in) ──
export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  status?: string;
}

export interface SendSmsOptions {
  to: string;
  body: string;
  /** Ignored — Quo reports delivery via webhook, not a per-message callback. */
  statusCallback?: string;
}

/**
 * Low-level Quo API fetch. Returns { ok, status, data } and never throws on
 * non-2xx — callers decide how to handle failures.
 */
export async function quoFetch(
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<{ ok: boolean; status: number; data: unknown }> {
  if (!apiKey) {
    return { ok: false, status: 0, data: { error: "Quo not configured" } };
  }
  const res = await fetch(`${QUO_BASE_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: init.body != null ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

/** Pull an id/status out of Quo's response whether or not it wraps in `data`. */
function unwrap(data: unknown): Record<string, unknown> {
  const d = data as { data?: Record<string, unknown> } | Record<string, unknown> | null;
  if (d && typeof d === "object" && "data" in d && d.data && typeof d.data === "object") {
    return d.data as Record<string, unknown>;
  }
  return (d as Record<string, unknown>) ?? {};
}

/**
 * Send an SMS via Quo. Mirrors the old Twilio `sendSms` shape exactly.
 */
export async function sendSms(options: SendSmsOptions): Promise<SendSmsResult> {
  if (!isQuoConfigured()) {
    console.warn("Quo not configured - SMS not sent");
    return { success: false, error: "Quo not configured" };
  }

  const normalizedTo = normalizePhoneNumber(options.to);
  if (!normalizedTo) {
    return { success: false, error: "Invalid phone number format" };
  }

  try {
    const { ok, status, data } = await quoFetch("/messages", {
      method: "POST",
      body: {
        content: options.body,
        from: fromNumber,
        to: [normalizedTo],
        ...(defaultUserId ? { userId: defaultUserId } : {}),
      },
    });

    if (!ok) {
      const body = unwrap(data);
      const errorMessage =
        (body.message as string) ||
        (body.error as string) ||
        `Quo API error (${status})`;
      console.error("Quo SMS error:", errorMessage);
      return { success: false, error: errorMessage };
    }

    const msg = unwrap(data);
    // Every outgoing SMS in the app funnels through here, so this is the one
    // place that can keep the tracked balance honest. Imported lazily to avoid
    // a module cycle (sms-balance -> notify -> prisma) and never awaited in a
    // way that can fail the send.
    import("@/lib/sms-balance")
      .then((m) => m.chargeForMessage(options.body))
      .catch(() => {});
    return {
      success: true,
      messageId: (msg.id as string) || undefined,
      status: (msg.status as string) || undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Quo SMS error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Normalize a phone number to E.164 for US numbers. (Ported verbatim from the
 * old twilio.ts so behavior is unchanged.)
 */
export function normalizePhoneNumber(phone: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 10 && phone.startsWith("+")) return `+${digits}`;
  return null;
}

// ── Calls ───────────────────────────────────────────────────────────────────

let cachedPhoneNumberId: string | null = null;

/** Our Quo phone-number id (PN...), resolved from the API and cached. */
export async function getQuoPhoneNumberId(): Promise<string | null> {
  if (cachedPhoneNumberId) return cachedPhoneNumberId;
  const res = await quoFetch("/phone-numbers");
  if (!res.ok) return null;
  const list = ((res.data as { data?: Array<{ id?: string; number?: string }> })?.data) || [];
  const ours = normalizePhoneNumber(getQuoFromNumber());
  const match = list.find((p) => ours && normalizePhoneNumber(p.number || "") === ours) || list[0];
  cachedPhoneNumberId = match?.id || null;
  return cachedPhoneNumberId;
}

export interface QuoCall {
  id: string;
  direction?: string;
  duration?: number;
  status?: string;
  createdAt?: string;
}

/** Calls exchanged with a given phone number, most recent first. */
export async function listCallsWith(phone: string, maxResults = 10): Promise<QuoCall[]> {
  const pn = await getQuoPhoneNumberId();
  const to = normalizePhoneNumber(phone);
  if (!pn || !to) return [];
  const res = await quoFetch(
    `/calls?phoneNumberId=${encodeURIComponent(pn)}&participants[]=${encodeURIComponent(to)}&maxResults=${maxResults}`
  );
  if (!res.ok) return [];
  return ((res.data as { data?: QuoCall[] })?.data) || [];
}

// ── Webhook helpers ─────────────────────────────────────────────────────────

/**
 * Verify a Quo webhook request. Quo signs deliveries with the webhook secret;
 * the exact header/scheme is confirmed at setup time. We accept either an HMAC
 * signature over the raw body OR a shared-secret bearer/query value, and — when
 * no secret is configured — allow through (matching the app's other webhooks).
 */
export function verifyQuoWebhook(opts: {
  rawBody: string;
  signatureHeader?: string | null;
  authHeader?: string | null;
  querySecret?: string | null;
}): boolean {
  // Quo issues a SEPARATE signing key per webhook subscription (messages, call
  // transcripts, ...), all delivering to this one endpoint. So accept a list:
  // QUO_WEBHOOK_SECRET may hold several secrets separated by commas/whitespace,
  // and a request is valid if it matches ANY of them. With one secret this
  // behaves exactly as before.
  const secrets = (process.env.QUO_WEBHOOK_SECRET || "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (secrets.length === 0) return true; // not configured → permissive (like sweepandgo)

  const bearer = opts.authHeader?.replace(/^Bearer\s+/i, "").trim();
  const provided = opts.signatureHeader?.replace(/^sha256=/i, "").trim();

  for (const secret of secrets) {
    // Shared-secret styles
    if (bearer && bearer === secret) return true;
    if (opts.querySecret && opts.querySecret === secret) return true;

    // HMAC-SHA256 over the raw body
    if (provided) {
      const expected = crypto.createHmac("sha256", secret).update(opts.rawBody).digest("hex");
      try {
        if (
          provided.length === expected.length &&
          crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
        ) {
          return true;
        }
      } catch {
        // try the next secret
      }
    }
  }
  return false;
}

export interface QuoInboundMessage {
  messageId: string;
  from: string;
  to: string;
  body: string;
  mediaUrls: string[];
  conversationId?: string;
  createdAt?: string;
}

/**
 * Normalize a Quo `message.received` webhook payload into a provider-neutral
 * shape. Quo (beta) wraps the resource under `data`; be tolerant of shape.
 */
export function parseInboundMessage(payload: unknown): QuoInboundMessage {
  // Quo/OpenPhone nests the resource under data.object; fall back to data, then
  // the top level, so we tolerate all shapes.
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const d = (p.data && typeof p.data === "object" ? (p.data as Record<string, unknown>) : p);
  const obj =
    d.object && typeof d.object === "object" ? (d.object as Record<string, unknown>) : d;
  const toRaw = obj.to;
  const to = Array.isArray(toRaw) ? String(toRaw[0] ?? "") : String(toRaw ?? "");
  const media = obj.media as Array<{ url?: string }> | string[] | undefined;
  const mediaUrls = Array.isArray(media)
    ? media
        .map((m) => (typeof m === "string" ? m : m?.url))
        .filter((u): u is string => !!u)
    : [];
  return {
    messageId: (obj.id as string) || "",
    from: String(obj.from ?? ""),
    to,
    body: (obj.content as string) || (obj.body as string) || (obj.text as string) || "",
    mediaUrls,
    conversationId: (obj.conversationId as string) || undefined,
    createdAt: (obj.createdAt as string) || undefined,
  };
}

/** Event name from a Quo webhook envelope (e.g. "message.received"). */
export function quoEventType(payload: unknown): string {
  const p = payload as { type?: string; event?: string } | null;
  return (p?.type as string) || (p?.event as string) || "";
}

// ── Contact sync ────────────────────────────────────────────────────────────

export interface QuoContactInput {
  /** Stable dedupe key, e.g. "quotelead:<id>" or "client:<uuid>". */
  externalId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  role?: string | null;
  /** Origin label shown in Quo (e.g. "DooGoodScoopers Web"). */
  source?: string;
}

const QUO_SOURCE = "DooGoodScoopers";

function buildDefaultFields(input: QuoContactInput) {
  const fields: Record<string, unknown> = {};
  if (input.firstName) fields.firstName = input.firstName;
  if (input.lastName) fields.lastName = input.lastName;
  if (input.company) fields.company = input.company;
  if (input.role) fields.role = input.role;
  const phone = input.phone ? normalizePhoneNumber(input.phone) : null;
  if (phone) fields.phoneNumbers = [{ name: "primary", value: phone }];
  if (input.email) fields.emails = [{ name: "primary", value: input.email }];
  return fields;
}

/**
 * Create or update a Quo contact, deduped by `externalId` (Quo owns the key, so
 * no local id storage is needed). Returns the contact id on success.
 */
export async function upsertQuoContact(
  input: QuoContactInput
): Promise<{ ok: boolean; id?: string; action?: "created" | "updated"; error?: string }> {
  if (!isQuoConfigured()) return { ok: false, error: "Quo not configured" };

  const source = input.source || QUO_SOURCE;
  const body = {
    defaultFields: buildDefaultFields(input),
    externalId: input.externalId,
    source,
  };

  // Look for an existing contact with this externalId first.
  const lookup = await quoFetch(
    `/contacts?externalIds=${encodeURIComponent(input.externalId)}&sources=${encodeURIComponent(source)}`
  );
  const existing = lookup.ok
    ? (((lookup.data as { data?: Array<{ id?: string }> })?.data) || [])[0]
    : undefined;

  if (existing?.id) {
    const res = await quoFetch(`/contacts/${existing.id}`, { method: "PATCH", body });
    return res.ok
      ? { ok: true, id: existing.id, action: "updated" }
      : { ok: false, error: `PATCH ${res.status}` };
  }

  const res = await quoFetch(`/contacts`, { method: "POST", body });
  const created = unwrap(res.data);
  return res.ok
    ? { ok: true, id: (created.id as string) || undefined, action: "created" }
    : { ok: false, error: `POST ${res.status}` };
}

/**
 * Contact sync hook, called at lead/client create/update points.
 *
 * DISABLED per owner request: this app no longer pushes leads or customers into
 * Quo as contacts (that was creating a named Quo contact for every new lead).
 * Kept as a no-op so the call sites don't need to change.
 *
 * NOTE: Quo may STILL auto-create a bare (name-less) contact for any phone number
 * it texts — that is a Quo workspace setting ("automatically create contacts"),
 * not something this app can control via the API. Turn it off in Quo settings to
 * stop those too.
 */
export function syncContactToQuo(input: QuoContactInput): void {
  void input; // intentionally unused — contact sync is disabled
}
