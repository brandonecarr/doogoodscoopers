/**
 * Sona calls — have Quo's AI agent phone a lead, from the lead's profile.
 *
 * Flow: the admin presses "Have Sona call", reviews the prefilled task, confirms →
 * startSonaCall() runs the guardrails, records a SonaCall row and asks Quo (via the
 * MCP connection in lib/quo-mcp) to dial. The UI and the sona-calls cron then
 * refreshSonaCall() every few seconds until Quo reports a final status, at which
 * point Sona's title/summary/collected details are written to the lead's timeline.
 *
 * Settings (AppSetting): sona.fromNumber (default +19093663744), sona.dailyCap (20),
 * sona.maxDurationSeconds (300).
 */
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { Prisma, type LeadSource } from "@prisma/client";
import { quoMcpCallTool, quoMcpStatus } from "@/lib/quo-mcp";
import { getLeadPersonalization } from "@/lib/personalization";
import { isOptedOut } from "@/lib/sms-optout";
import { loadSendWindow, isWithinSendWindow } from "@/lib/send-window";
import { normalizePhoneNumber } from "@/lib/quo";
import { compilePlaybook, parsePlaybook, fillTokens, DEFAULT_SONA_PLAYBOOKS, SONA_LEAD_TYPES, SONA_MAX_TASK, type SonaPlaybookLeadType } from "@/lib/sona-playbook";

export const SONA_FINAL = new Set(["completed", "failed", "no-answer", "busy", "voicemail", "voicemail-left", "canceled", "error"]);
export type SonaLeadType = Extract<LeadSource, "QUOTE_FORM" | "AD_LEAD" | "COMMERCIAL" | "OUT_OF_AREA">;

export interface SonaSettings { fromNumber: string; dailyCap: number; maxDurationSeconds: number }
export async function sonaSettings(): Promise<SonaSettings> {
  const rows = await prisma.appSetting.findMany({ where: { key: { startsWith: "sona." } } });
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value.trim()]));
  const n = (v: string | undefined, d: number) => { const x = Number(v); return Number.isFinite(x) && v !== undefined && v !== "" ? x : d; };
  return {
    fromNumber: m["sona.fromNumber"] || "+19093663744",
    dailyCap: Math.max(0, n(m["sona.dailyCap"], 20)),
    maxDurationSeconds: Math.min(600, Math.max(30, n(m["sona.maxDurationSeconds"], 300))),
  };
}

/** The lead fields a call needs, read the same way for every lead type. */
export interface SonaLeadInfo { name: string; firstName: string; phone: string | null; email: string | null; marketingAllowed: boolean | null; archived: boolean }
export async function sonaLeadInfo(leadType: LeadSource, leadId: string): Promise<SonaLeadInfo | null> {
  if (leadType === "QUOTE_FORM") {
    const l = await prisma.quoteLead.findUnique({ where: { id: leadId }, select: { firstName: true, lastName: true, phone: true, email: true, marketingAllowed: true, archived: true } });
    return l && { name: [l.firstName, l.lastName].filter(Boolean).join(" "), firstName: l.firstName || "", phone: l.phone, email: l.email, marketingAllowed: l.marketingAllowed, archived: l.archived };
  }
  if (leadType === "AD_LEAD") {
    const l = await prisma.adLead.findUnique({ where: { id: leadId }, select: { firstName: true, lastName: true, fullName: true, phone: true, email: true, archived: true } });
    return l && { name: l.fullName || [l.firstName, l.lastName].filter(Boolean).join(" "), firstName: l.firstName || (l.fullName || "").split(/\s+/)[0] || "", phone: l.phone, email: l.email, marketingAllowed: null, archived: l.archived };
  }
  if (leadType === "COMMERCIAL") {
    const l = await prisma.commercialLead.findUnique({ where: { id: leadId }, select: { contactName: true, phone: true, email: true, archived: true } });
    return l && { name: l.contactName || "", firstName: (l.contactName || "").split(/\s+/)[0] || "", phone: l.phone, email: l.email, marketingAllowed: null, archived: l.archived };
  }
  if (leadType === "OUT_OF_AREA") {
    const l = await prisma.outOfAreaLead.findUnique({ where: { id: leadId }, select: { firstName: true, lastName: true, phone: true, email: true, archived: true } });
    return l && { name: [l.firstName, l.lastName].filter(Boolean).join(" "), firstName: l.firstName || "", phone: l.phone, email: l.email, marketingAllowed: null, archived: l.archived };
  }
  return null;
}

/** E.164 for Quo, or null if the number isn't a usable US number. */
export function toE164(phone: string | null | undefined): string | null {
  const n = phone ? normalizePhoneNumber(phone) : null;
  return n && /^\+1\d{10}$/.test(n) ? n : null;
}

const CALL_FACTS =
  "Key facts you can share: no contracts, cancel any time; the first visit is an initial cleanup priced after we see the yard, then the regular rate applies; the card on file is billed on the 1st of the month; we text when we're on the way and send a photo of the closed gate when done; a sanitizing and deodorizing spray can be added to any visit; questions can go to (909) 366-3744. " +
  "Do not book a specific date or time; say Brandon or Valerie will confirm the first visit. If they say they already signed up, thank them and end the call. If they're not interested, thank them politely and end the call. Keep the call under three minutes and never argue.";

/**
 * The prefilled task for the confirm panel. Precedence: the owner's playbook for this
 * lead type (/admin/sona-playbooks) → a plain-text template (sona.task.<TYPE>) →
 * the built-in playbook. Tokens are filled from the lead.
 */
export async function defaultSonaTask(leadType: LeadSource, leadId: string): Promise<string> {
  const v = await getLeadPersonalization(leadType, leadId);
  const [pbRow, txtRow] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: `sona.playbook.${leadType}` } }),
    prisma.appSetting.findUnique({ where: { key: `sona.task.${leadType}` } }),
  ]);
  const playbook = parsePlaybook(pbRow?.value);
  const type = (SONA_LEAD_TYPES as readonly string[]).includes(leadType) ? (leadType as SonaPlaybookLeadType) : "OUT_OF_AREA";
  const template = playbook ? compilePlaybook(playbook) : (txtRow?.value?.trim() || compilePlaybook(DEFAULT_SONA_PLAYBOOKS[type]));
  const where = [v.city, v.zipCode].filter(Boolean).join(" ");
  const quoteDetails = [v.dogs, v.frequency ? `${v.frequency.toLowerCase()} service` : "", where ? `in ${where}` : ""].filter(Boolean).join(", ");
  const vars: Record<string, string> = {
    ...v,
    firstName: v.firstName || v.name || "the lead",
    quoteDetails: quoteDetails || "their yard",
    quoteDetailsClause: quoteDetails ? ` for ${quoteDetails}` : "",
    whereClause: where ? ` from ${where}` : "",
    rateSentence: v.monthlyRate ? ` Their quoted rate is ${v.monthlyRate} per month.` : "",
    callFacts: CALL_FACTS,
  };
  return fillTokens(template, vars).slice(0, SONA_MAX_TASK);
}

export interface StartSonaCallInput {
  leadType: LeadSource; leadId: string; task: string; byEmail: string;
  voicemail?: "hang-up" | "leave-message"; voicemailMessage?: string | null; maxDurationSeconds?: number;
  /** Set when the admin saw the warning and chose to call anyway. */
  overrideConsent?: boolean;
}
export type StartSonaCallResult = { ok: true; id: string } | { ok: false; error: string; code: "not_connected" | "no_phone" | "blocked" | "consent" | "window" | "cap" | "quo" | "input" };

export async function startSonaCall(input: StartSonaCallInput): Promise<StartSonaCallResult> {
  const task = (input.task || "").trim();
  if (task.length < 20) return { ok: false, code: "input", error: "The task needs to say what Sona should do on the call." };
  if (task.length > 2000) return { ok: false, code: "input", error: "The task is longer than Quo allows (2,000 characters)." };
  const status = await quoMcpStatus();
  if (!status.connected) return { ok: false, code: "not_connected", error: "Quo isn't connected. Connect it from Settings → Sona calls." };

  const lead = await sonaLeadInfo(input.leadType, input.leadId);
  if (!lead) return { ok: false, code: "input", error: "Lead not found." };
  const to = toE164(lead.phone);
  if (!to) return { ok: false, code: "no_phone", error: "This lead has no usable US phone number." };
  const last10 = to.slice(-10);

  // ── Guardrails ────────────────────────────────────────────────────────────
  const dnc = await prisma.doNotContact.findFirst({ where: { OR: [{ phone: last10 }, ...(lead.email ? [{ email: { equals: lead.email, mode: "insensitive" as const } }] : [])] }, select: { id: true } });
  if (dnc) return { ok: false, code: "blocked", error: "This person is on the do-not-contact list." };
  if (await isOptedOut(to)) return { ok: false, code: "blocked", error: "This number opted out of messages, so Sona won't call it." };
  if (lead.marketingAllowed === false && !input.overrideConsent) return { ok: false, code: "consent", error: "This lead said no to marketing contact. Confirm you still want Sona to call." };
  const win = await loadSendWindow();
  if (!isWithinSendWindow(new Date(), win)) return { ok: false, code: "window", error: `Outside calling hours (${win.startHour}:00–${win.endHour}:00 ${win.timeZone}).` };
  const s = await sonaSettings();
  const since = new Date(); since.setHours(0, 0, 0, 0);
  const today = await prisma.sonaCall.count({ where: { createdAt: { gte: since }, status: { not: "error" } } });
  if (s.dailyCap > 0 && today >= s.dailyCap) return { ok: false, code: "cap", error: `Daily cap of ${s.dailyCap} Sona calls reached. Raise it in Settings if you need more today.` };

  // ── Record, then dial ─────────────────────────────────────────────────────
  const idempotencyKey = `sona-${input.leadId}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`.slice(0, 128);
  const row = await prisma.sonaCall.create({
    data: {
      leadType: input.leadType, leadId: input.leadId, leadName: lead.name || null,
      fromNumber: s.fromNumber, toNumber: to, task,
      voicemail: input.voicemail === "leave-message" ? "leave-message" : "hang-up",
      voicemailMessage: input.voicemail === "leave-message" ? (input.voicemailMessage || null) : null,
      maxDurationSeconds: Math.min(600, Math.max(30, input.maxDurationSeconds || s.maxDurationSeconds)),
      idempotencyKey, status: "queued", startedBy: input.byEmail,
    },
  });
  try {
    const args: Record<string, unknown> = {
      from: row.fromNumber, to: row.toNumber, task: row.task, idempotencyKey: row.idempotencyKey,
      maxDurationSeconds: row.maxDurationSeconds, voicemail: row.voicemail, userConfirmed: true,
    };
    if (row.voicemailMessage) args.voicemailMessage = row.voicemailMessage;
    const r = await quoMcpCallTool("start-agent-call", args);
    const agentCallId = extractAgentCallId(r.json, r.text);
    if (r.isError || !agentCallId) {
      await prisma.sonaCall.update({ where: { id: row.id }, data: { status: "error", error: r.text.slice(0, 2000) || "Quo did not return an agent call id.", rawResult: toJson(r.json ?? r.text), endedAt: new Date() } });
      return { ok: false, code: "quo", error: r.text.slice(0, 300) || "Quo did not start the call." };
    }
    await prisma.sonaCall.update({ where: { id: row.id }, data: { agentCallId, status: "in-progress", startedAt: new Date(), rawResult: toJson(r.json ?? r.text) } });
    await prisma.leadUpdate.create({ data: { leadType: input.leadType, leadId: input.leadId, communicationType: "phone_call", adminEmail: input.byEmail, message: `📞 Sona is calling ${lead.firstName || lead.name || "the lead"} at ${fmtPhone(to)}.` } }).catch(() => {});
    return { ok: true, id: row.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.sonaCall.update({ where: { id: row.id }, data: { status: "error", error: msg.slice(0, 2000), endedAt: new Date() } }).catch(() => {});
    return { ok: false, code: "quo", error: msg };
  }
}

/** Ask Quo for the call's current state; on a final status, file the summary on the lead. */
export async function refreshSonaCall(id: string): Promise<void> {
  const row = await prisma.sonaCall.findUnique({ where: { id } });
  if (!row || !row.agentCallId || SONA_FINAL.has(row.status)) return;
  const r = await quoMcpCallTool("get-agent-call", { agentCallId: row.agentCallId });
  const parsed = parseAgentCall(r.json, r.text);
  const status = parsed.status || row.status;
  const final = SONA_FINAL.has(status);
  await prisma.sonaCall.update({
    where: { id },
    data: {
      status, lastPolledAt: new Date(), rawResult: toJson(r.json ?? r.text),
      title: parsed.title ?? row.title, summary: parsed.summary ?? row.summary,
      collectedData: parsed.collectedData !== undefined ? toJson(parsed.collectedData) : undefined,
      endedAt: final ? new Date() : row.endedAt,
    },
  });
  if (final && !row.noteId) {
    const lines = [`📞 Sona call ${STATUS_LABEL[status] || status}${parsed.title ? `: ${parsed.title}` : ""}`];
    if (parsed.summary) lines.push(parsed.summary);
    if (parsed.collectedData && typeof parsed.collectedData === "object") {
      for (const [k, v] of Object.entries(parsed.collectedData as Record<string, unknown>)) if (v !== null && v !== "" && v !== undefined) lines.push(`• ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
    }
    const note = await prisma.leadUpdate.create({ data: { leadType: row.leadType, leadId: row.leadId, communicationType: "phone_call", adminEmail: "sona", message: lines.join("\n").slice(0, 4000) } }).catch(() => null);
    if (note) await prisma.sonaCall.update({ where: { id }, data: { noteId: note.id } }).catch(() => {});
  }
}

export async function cancelSonaCall(id: string): Promise<void> {
  const row = await prisma.sonaCall.findUnique({ where: { id } });
  if (!row) return;
  if (!row.agentCallId) { await prisma.sonaCall.update({ where: { id }, data: { status: "canceled", endedAt: new Date() } }); return; }
  if (SONA_FINAL.has(row.status)) return;
  await quoMcpCallTool("cancel-agent-call", { agentCallId: row.agentCallId }).catch(() => {});
  await refreshSonaCall(id);
  const after = await prisma.sonaCall.findUnique({ where: { id }, select: { status: true } });
  if (after && !SONA_FINAL.has(after.status)) await prisma.sonaCall.update({ where: { id }, data: { status: "canceled", endedAt: new Date() } });
}

/** Every call still running — polled by the cron as a safety net behind the UI. */
export async function refreshOpenSonaCalls(): Promise<number> {
  const open = await prisma.sonaCall.findMany({ where: { agentCallId: { not: null }, status: { notIn: [...SONA_FINAL] } }, select: { id: true, startedAt: true } });
  let n = 0;
  for (const c of open) {
    try { await refreshSonaCall(c.id); n++; } catch (e) { console.error("[sona] refresh failed", c.id, e); }
    // A call that Quo never finalized after 20 minutes is treated as ended so it stops polling.
    if (c.startedAt && Date.now() - c.startedAt.getTime() > 20 * 60_000) {
      await prisma.sonaCall.updateMany({ where: { id: c.id, status: { notIn: [...SONA_FINAL] } }, data: { status: "error", error: "No final status from Quo after 20 minutes.", endedAt: new Date() } });
    }
  }
  return n;
}

export const STATUS_LABEL: Record<string, string> = {
  queued: "queued", "in-progress": "in progress", ringing: "ringing", dialing: "dialing", completed: "completed", failed: "failed",
  "no-answer": "no answer", busy: "busy", voicemail: "reached voicemail", "voicemail-left": "left a voicemail", canceled: "canceled", error: "error",
};

// ── Quo response parsing (the MCP answers in prose or JSON; take whatever is there) ──
function extractAgentCallId(json: unknown, text: string): string | null {
  const j = json as Record<string, unknown> | null;
  for (const k of ["agentCallId", "id", "agent_call_id"]) { const v = j && typeof j[k] === "string" ? (j[k] as string) : null; if (v && /^AR/i.test(v)) return v; }
  const m = text.match(/\b(AR[A-Za-z0-9_-]{6,})\b/); return m ? m[1] : null;
}
function parseAgentCall(json: unknown, text: string): { status: string | null; title?: string | null; summary?: string | null; collectedData?: unknown } {
  const j = (json && typeof json === "object" ? json : null) as Record<string, unknown> | null;
  const pick = (keys: string[]): string | null => { if (!j) return null; for (const k of keys) { const v = j[k]; if (typeof v === "string" && v.trim()) return v.trim(); } return null; };
  let status = pick(["status", "state"]);
  if (!status) { const m = text.match(/status\s*[:=]\s*"?([a-z-]+)/i); status = m ? m[1].toLowerCase() : null; }
  if (status) status = status.toLowerCase().replace(/_/g, "-");
  const title = pick(["title"]) ?? (text.match(/^title\s*[:=]\s*(.+)$/im)?.[1]?.trim() ?? null);
  const summary = pick(["summary"]) ?? (text.match(/summary\s*[:=]\s*([\s\S]+?)(?:\n\s*\n|$)/i)?.[1]?.trim() ?? null);
  const collectedData = j ? (j.collectedData ?? j.collected_data ?? j.data ?? undefined) : undefined;
  return { status, title, summary, collectedData };
}
function toJson(v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull { return v === undefined || v === null ? Prisma.JsonNull : (v as Prisma.InputJsonValue); }
function fmtPhone(e164: string): string { const d = e164.slice(-10); return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`; }
