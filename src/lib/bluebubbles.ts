/**
 * BlueBubbles relay — texts sent from the office iPhone's number as iMessage
 * (blue bubble) or, through the iPhone's Text Message Forwarding, as SMS.
 *
 * BlueBubbles Server runs on the office Mac mini in the "DGS Relay" macOS user,
 * driving the Messages app signed in as service@doogoodscoopers.com. We talk to
 * its REST API; it posts replies, delivery updates and send errors back to
 * /api/webhooks/bluebubbles.
 *
 * Config:
 *   env   BLUEBUBBLES_PASSWORD          the server password (auth is `?password=` on every call)
 *   env   BLUEBUBBLES_WEBHOOK_SECRET    optional; defaults to a hash of the password
 *   AppSetting relay.url                the server URL (auto-updated by the "new-server" webhook
 *                                       when the built-in Cloudflare tunnel changes)
 *   AppSetting relay.number             our number on the iPhone (E.164)
 *   AppSetting relay.enabled            "true" | "false"
 *   AppSetting relay.fallbackToQuo      "true" | "false" — send through Quo when the relay fails
 *   AppSetting relay.dailyCap           a number, or blank for the warm-up ramp (40 → 100 → 200)
 *   AppSetting relay.rampStart          ISO date the relay first went live (ramp week 1 starts here)
 *   AppSetting campaigns.textProvider   "quo" | "iphone" — where campaign texts go by default
 */

import crypto from "crypto";
import prisma from "@/lib/prisma";
import { normalizePhoneNumber, type SendSmsResult } from "@/lib/quo";

export const RELAY_DEFAULT_NUMBER = "+17609876771";
const TIMEOUT_MS = 20_000;
/** Warm-up ramp for a brand-new number: per-day caps by week since rampStart. */
export const RAMP_CAPS = [40, 100];
export const RAMP_FINAL_CAP = 200;
/** Minimum spacing between two relay sends, across every cron. */
export const MIN_GAP_MS = 20_000;

export type RelayService = "iMessage" | "SMS";

export interface RelayConfig { url: string; password: string; number: string; enabled: boolean; fallbackToQuo: boolean }

const getSetting = async (key: string) => (await prisma.appSetting.findUnique({ where: { key } }))?.value ?? null;
export async function setRelaySetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/** Everything needed to talk to the relay, or null when the password or URL is missing. */
export async function relayConfig(): Promise<RelayConfig | null> {
  const password = process.env.BLUEBUBBLES_PASSWORD;
  if (!password) return null;
  const [url, number, enabled, fallback] = await Promise.all([
    getSetting("relay.url"), getSetting("relay.number"), getSetting("relay.enabled"), getSetting("relay.fallbackToQuo"),
  ]);
  if (!url) return null;
  return {
    url: url.replace(/\/+$/, ""),
    password,
    number: normalizePhoneNumber(number || RELAY_DEFAULT_NUMBER) || RELAY_DEFAULT_NUMBER,
    enabled: enabled !== "false",
    fallbackToQuo: fallback !== "false",
  };
}

/** True when the relay has a password + URL and hasn't been switched off. */
export async function isRelayConfigured(): Promise<boolean> {
  const c = await relayConfig();
  return !!c && c.enabled;
}

/** Our iPhone number (E.164), whether or not the relay is live. */
export async function relayNumber(): Promise<string> {
  const n = await getSetting("relay.number");
  return normalizePhoneNumber(n || RELAY_DEFAULT_NUMBER) || RELAY_DEFAULT_NUMBER;
}

/** The secret the webhook URL carries. Explicit env var, else derived from the password. */
export function relayWebhookSecret(): string | null {
  if (process.env.BLUEBUBBLES_WEBHOOK_SECRET) return process.env.BLUEBUBBLES_WEBHOOK_SECRET;
  const pw = process.env.BLUEBUBBLES_PASSWORD;
  return pw ? crypto.createHash("sha256").update(`bluebubbles-webhook:${pw}`).digest("hex").slice(0, 32) : null;
}

// ── HTTP ─────────────────────────────────────────────────────────────────────

interface RelayResponse { ok: boolean; status: number; data: unknown; message: string }

async function relayFetch(cfg: RelayConfig, path: string, init: { method?: string; body?: unknown } = {}): Promise<RelayResponse> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${cfg.url}${path}${sep}password=${encodeURIComponent(cfg.password)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try { json = JSON.parse(text) as Record<string, unknown>; } catch { json = { message: text.slice(0, 200) }; }
    const err = json.error as { message?: string; error?: string } | string | undefined;
    const message = String(
      (typeof err === "object" && err ? err.message || err.error : err) || json.message || `${res.status} ${res.statusText}`,
    );
    return { ok: res.ok && !(typeof json.status === "number" && json.status >= 400), status: res.status, data: json.data, message };
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    return { ok: false, status: 0, data: null, message: aborted ? "relay timed out" : `relay unreachable: ${(e as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}

// ── Health ───────────────────────────────────────────────────────────────────

export interface RelayHealth {
  ok: boolean;
  error?: string;
  serverVersion?: string;
  macOS?: string;
  privateApi?: boolean;
  helperConnected?: boolean;
  proxy?: string;
}

/** Pings the relay and reads its server info (version, Private API state). */
export async function relayHealth(cfg?: RelayConfig | null): Promise<RelayHealth> {
  const c = cfg ?? (await relayConfig());
  if (!c) return { ok: false, error: "Relay not configured (needs BLUEBUBBLES_PASSWORD and a server URL)" };
  const info = await relayFetch(c, "/api/v1/server/info");
  if (!info.ok) return { ok: false, error: info.message };
  const d = (info.data || {}) as Record<string, unknown>;
  return {
    ok: true,
    serverVersion: typeof d.server_version === "string" ? d.server_version : undefined,
    macOS: typeof d.os_version === "string" ? d.os_version : undefined,
    privateApi: typeof d.private_api === "boolean" ? d.private_api : undefined,
    helperConnected: typeof d.helper_connected === "boolean" ? d.helper_connected : undefined,
    proxy: typeof d.proxy_service === "string" ? d.proxy_service : undefined,
  };
}

// ── Sending ──────────────────────────────────────────────────────────────────

export interface RelaySendResult extends SendSmsResult { service?: RelayService }

/** Pulls the new message's GUID out of a message/text or chat/new response. */
function messageGuid(data: unknown): string | null {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const guid = typeof d.guid === "string" ? d.guid : "";
  // Message GUIDs look like "p:0/XXXX…"; chat GUIDs like "iMessage;-;+1…".
  if (guid && !/;-;|;\+;/.test(guid)) return guid;
  const msgs = Array.isArray(d.messages) ? (d.messages as Array<Record<string, unknown>>) : [];
  const first = msgs.find((m) => typeof m.guid === "string");
  if (first) return first.guid as string;
  const last = d.lastMessage as Record<string, unknown> | undefined;
  return last && typeof last.guid === "string" ? last.guid : null;
}

function sendError(data: unknown): number {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  return typeof d.error === "number" ? d.error : 0;
}

/** Whether an address can receive iMessage (Private API). Null when the relay can't tell. */
async function iMessageAvailable(cfg: RelayConfig, address: string): Promise<boolean | null> {
  const r = await relayFetch(cfg, `/api/v1/handle/availability/imessage?address=${encodeURIComponent(address)}`);
  if (!r.ok) return null;
  const d = (r.data || {}) as Record<string, unknown>;
  return typeof d.available === "boolean" ? d.available : null;
}

async function sendVia(cfg: RelayConfig, service: RelayService, to: string, body: string): Promise<RelaySendResult> {
  const tempGuid = `dgs-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  // 1) The chat already exists (we've texted or heard from them before).
  const direct = await relayFetch(cfg, "/api/v1/message/text", {
    method: "POST",
    body: { chatGuid: `${service};-;${to}`, tempGuid, message: body, method: "private-api" },
  });
  if (direct.ok && !sendError(direct.data)) {
    return { success: true, messageId: messageGuid(direct.data) ?? tempGuid, status: "SENT", service };
  }
  if (direct.status === 0) return { success: false, error: direct.message, service }; // unreachable — don't try again
  // 2) First contact: create the conversation with the message (needs the Private API).
  const created = await relayFetch(cfg, "/api/v1/chat/new", {
    method: "POST",
    body: { addresses: [to], service, message: body, method: "private-api", tempGuid },
  });
  if (created.ok && !sendError(created.data)) {
    return { success: true, messageId: messageGuid(created.data) ?? tempGuid, status: "SENT", service };
  }
  const code = sendError(created.data) || sendError(direct.data);
  return { success: false, error: `${service}: ${created.message || direct.message}${code ? ` (code ${code})` : ""}`, service };
}

/**
 * Sends a text from the iPhone number. iMessage when the recipient has it,
 * otherwise SMS through the iPhone's Text Message Forwarding. Never retries a
 * send that may have gone through.
 */
export async function sendRelayText(options: { to: string; body: string }): Promise<RelaySendResult> {
  const cfg = await relayConfig();
  if (!cfg) return { success: false, error: "iPhone relay not configured" };
  if (!cfg.enabled) return { success: false, error: "iPhone relay is switched off" };
  const to = normalizePhoneNumber(options.to);
  if (!to) return { success: false, error: "Invalid phone number format" };

  const avail = await iMessageAvailable(cfg, to);
  const order: RelayService[] = avail === false ? ["SMS"] : avail === true ? ["iMessage", "SMS"] : ["iMessage", "SMS"];
  let last: RelaySendResult = { success: false, error: "no send path" };
  for (const service of order) {
    last = await sendVia(cfg, service, to, options.body);
    if (last.success) break;
    if (/unreachable|timed out/.test(last.error || "")) break;
  }
  if (last.success) {
    await setRelaySetting("relay.lastSendAt", new Date().toISOString()).catch(() => {});
  }
  return last;
}

// ── Pacing ───────────────────────────────────────────────────────────────────

/** Start of today in Pacific time, as a Date. */
function pacificDayStart(now = new Date()): Date {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  const secondsIntoDay = Number(p.hour) % 24 * 3600 + Number(p.minute) * 60 + Number(p.second);
  return new Date(now.getTime() - secondsIntoDay * 1000);
}

/** Today's cap: the owner's number, else the warm-up ramp by weeks since rampStart. */
export async function relayDailyCap(): Promise<number> {
  const [capRaw, rampStart] = await Promise.all([getSetting("relay.dailyCap"), getSetting("relay.rampStart")]);
  const cap = Number(capRaw);
  if (capRaw && Number.isFinite(cap) && cap > 0) return Math.round(cap);
  const start = rampStart ? new Date(rampStart) : null;
  const week = start && !isNaN(start.getTime()) ? Math.floor((Date.now() - start.getTime()) / (7 * 86_400_000)) : 0;
  return RAMP_CAPS[Math.max(0, week)] ?? RAMP_FINAL_CAP;
}

/** Texts sent from the iPhone so far today (Pacific). */
export async function relaySentToday(): Promise<number> {
  return prisma.leadMessage.count({ where: { provider: "iphone", direction: "OUTBOUND", createdAt: { gte: pacificDayStart() } } });
}

export interface RelayAllowance { ok: boolean; reason?: string; cap: number; sentToday: number }

/**
 * Whether one more relay send is allowed right now: under today's cap and at
 * least MIN_GAP_MS since the last one. Callers that get `ok: false` leave the
 * message queued for a later run — never fall back to Quo for pacing.
 */
export async function relayAllowance(): Promise<RelayAllowance> {
  const [cap, sentToday, lastRaw] = await Promise.all([relayDailyCap(), relaySentToday(), getSetting("relay.lastSendAt")]);
  if (sentToday >= cap) return { ok: false, reason: `daily cap of ${cap} reached`, cap, sentToday };
  const last = lastRaw ? new Date(lastRaw).getTime() : 0;
  if (last && Date.now() - last < MIN_GAP_MS) return { ok: false, reason: "spacing", cap, sentToday };
  return { ok: true, cap, sentToday };
}

// ── Webhook payloads ─────────────────────────────────────────────────────────

export interface RelayMessageEvent {
  type: string;
  guid: string;
  text: string;
  /** The other party's address (E.164 phone or an email for iMessage-only handles). */
  address: string;
  isFromMe: boolean;
  isGroup: boolean;
  chatGuid: string;
  service: string;
  error: number;
  delivered: boolean;
  read: boolean;
  hasAttachments: boolean;
}

/** Normalizes a BlueBubbles webhook body. Null when it isn't a message event. */
export function parseRelayEvent(payload: unknown): RelayMessageEvent | null {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const type = typeof p.type === "string" ? p.type : "";
  const d = p.data && typeof p.data === "object" ? (p.data as Record<string, unknown>) : null;
  if (!d || typeof d.guid !== "string") return null;
  const handle = d.handle && typeof d.handle === "object" ? (d.handle as Record<string, unknown>) : {};
  const chats = Array.isArray(d.chats) ? (d.chats as Array<Record<string, unknown>>) : [];
  const chatGuid = typeof chats[0]?.guid === "string" ? (chats[0].guid as string) : "";
  // A DM chat GUID is "iMessage;-;<address>"; groups use ";+;".
  const addrFromChat = chatGuid.includes(";-;") ? chatGuid.split(";-;")[1] : "";
  const address = (typeof handle.address === "string" && handle.address) || addrFromChat || "";
  const attachments = Array.isArray(d.attachments) ? d.attachments.length : 0;
  return {
    type,
    guid: d.guid,
    text: typeof d.text === "string" ? d.text : "",
    address,
    isFromMe: d.isFromMe === true,
    isGroup: chatGuid.includes(";+;") || (Array.isArray(chats[0]?.participants) && (chats[0].participants as unknown[]).length > 1),
    chatGuid,
    service: (typeof handle.service === "string" && handle.service) || chatGuid.split(";")[0] || "iMessage",
    error: typeof d.error === "number" ? d.error : 0,
    delivered: !!d.dateDelivered,
    read: !!d.dateRead,
    hasAttachments: attachments > 0,
  };
}
