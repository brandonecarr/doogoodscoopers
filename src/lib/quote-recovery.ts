import crypto from "crypto";
import prisma from "@/lib/prisma";
import type { QuoteLead } from "@prisma/client";

// ── Quote recovery ────────────────────────────────────────────────────────────
// A Sweep&Go quote lead who never finished signing up gets a personal resume link
// (doogoodscoopers.com/r/?c=A7K29P). The resume page on the website asks this app
// for the lead's answers and sends them on to the schedule page with everything
// filled in and the original Sweep&Go quote entry attached, so the signup finishes
// the same entry instead of creating a new one. Everything here is driven by the
// free:quote webhook; nothing is written to Sweep&Go.

export const RECOVERY_DEFAULTS = {
  abandonMinutes: 30,  // a quote with no signup after this long is "abandoned"
  linkExpiryDays: 30,  // resume links expire this long after the lead's last activity (0 = never)
  coupon: "WELCOME25", // applied on the resume link and available as {{coupon}}
  resumeBase: "https://doogoodscoopers.com/r/?c=",
  scheduleUrl: "https://doogoodscoopers.com/schedule-service/",
  quoteUrl: "https://doogoodscoopers.com/get-a-quote/",
};
export type RecoverySettings = typeof RECOVERY_DEFAULTS;

export async function recoverySettings(): Promise<RecoverySettings> {
  const rows = await prisma.appSetting.findMany({ where: { key: { startsWith: "recovery." } } });
  const v = Object.fromEntries(rows.map((r) => [r.key.slice("recovery.".length), r.value.trim()]));
  const num = (k: keyof RecoverySettings) => { const n = Number(v[k]); return Number.isFinite(n) && v[k] !== "" ? n : (RECOVERY_DEFAULTS[k] as number); };
  return {
    abandonMinutes: Math.max(1, num("abandonMinutes")),
    linkExpiryDays: Math.max(0, num("linkExpiryDays")),
    coupon: v.coupon ?? RECOVERY_DEFAULTS.coupon,
    resumeBase: v.resumeBase || RECOVERY_DEFAULTS.resumeBase,
    scheduleUrl: v.scheduleUrl || RECOVERY_DEFAULTS.scheduleUrl,
    quoteUrl: v.quoteUrl || RECOVERY_DEFAULTS.quoteUrl,
  };
}

// 6 characters, no look-alikes (0/O, 1/I/L), so a code can be read out over the phone.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function newResumeCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return s;
}

/** Only quotes that came through the website's quote wizard / Sweep&Go quote form can be resumed there. */
export function isSngQuoteLead(lead: { lastStep: string | null }): boolean {
  return /sweep&go|quote wizard/i.test(lead.lastStep || "");
}
/** Prisma filter for the same set. */
export const SNG_QUOTE_WHERE = { OR: [{ lastStep: { contains: "Sweep&Go" } }, { lastStep: { contains: "Quote Wizard" } }] };

/** The lead's resume code, creating one the first time it's needed. */
export async function ensureResumeCode(leadId: string): Promise<string | null> {
  const lead = await prisma.quoteLead.findUnique({ where: { id: leadId }, select: { resumeCode: true, lastStep: true } });
  if (!lead || !isSngQuoteLead(lead)) return null;
  if (lead.resumeCode) return lead.resumeCode;
  return setNewCode(leadId);
}

async function setNewCode(leadId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newResumeCode();
    try {
      await prisma.quoteLead.update({ where: { id: leadId }, data: { resumeCode: code, resumeDisabled: false } });
      return code;
    } catch (e) {
      if (!(e instanceof Error && /Unique constraint/i.test(e.message))) throw e;
    }
  }
  throw new Error("Could not generate a unique resume code");
}

export const regenerateResumeCode = setNewCode;

export type ResumeChannel = "sms" | "email" | "other";

/** The link to put in a message. Leads that can't be resumed get the plain quote page. */
export async function resumeLinkForLead(leadId: string, channel?: ResumeChannel, settings?: RecoverySettings): Promise<string> {
  const s = settings ?? (await recoverySettings());
  const code = await ensureResumeCode(leadId);
  if (!code) return s.quoteUrl;
  return `${s.resumeBase}${code}${channel ? `&ch=${channel === "sms" ? "s" : channel === "email" ? "e" : "o"}` : ""}`;
}

export type RecoveryStatus = "signed_up" | "returned" | "abandoned" | "quoted" | "archived";

export function recoveryStatus(lead: Pick<QuoteLead, "status" | "archived" | "convertedAt" | "resumeOpenedAt" | "createdAt">, s: RecoverySettings, now = new Date()): RecoveryStatus {
  if (lead.status === "CONVERTED" || lead.convertedAt) return "signed_up";
  if (lead.archived) return "archived";
  if (lead.resumeOpenedAt) return "returned";
  if (now.getTime() - lead.createdAt.getTime() > s.abandonMinutes * 60_000) return "abandoned";
  return "quoted";
}

export const RECOVERY_LABEL: Record<RecoveryStatus, string> = {
  quoted: "Quoted", abandoned: "Abandoned", returned: "Returned", signed_up: "Signed up", archived: "Archived",
};

export function linkExpiresAt(lead: Pick<QuoteLead, "lastActivityAt" | "createdAt">, s: RecoverySettings): Date | null {
  if (!s.linkExpiryDays) return null;
  const last = lead.lastActivityAt ?? lead.createdAt;
  return new Date(last.getTime() + s.linkExpiryDays * 86_400_000);
}

const digits = (p: string | null | undefined) => (p || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");

/**
 * The quote wizard on the website posts every quote to the quote-wizard-extras
 * function, which stores it in QuoteWizardSubmission (not a Prisma model) with the
 * Sweep&Go entry + submission ids and the price shown. That record arrives seconds
 * after the quote; the free:quote webhook (which also carries the entry id) can
 * take much longer, so this is the primary source.
 */
export interface WizardSubmission { sngEntryId: string | null; sngSubmissionId: string | null; quotedPrice: string | null }
export async function wizardSubmissionFor(lead: Pick<QuoteLead, "id" | "phone">): Promise<WizardSubmission | null> {
  const phone = digits(lead.phone);
  const rows = await prisma.$queryRaw<Array<{ sngEntryId: string | null; sngSubmissionId: string | null; quotedPrice: string | null }>>`
    SELECT "sngEntryId", "sngSubmissionId", "quotedPrice" FROM "QuoteWizardSubmission"
    WHERE "outOfArea" = false AND ("quoteLeadId" = ${lead.id} OR (${phone} <> '' AND phone = ${phone}))
    ORDER BY "createdAt" DESC LIMIT 1`.catch(() => []);
  const r = rows[0];
  return r ? { sngEntryId: r.sngEntryId || null, sngSubmissionId: r.sngSubmissionId || null, quotedPrice: r.quotedPrice || null } : null;
}

/** The schedule page URL with the lead's answers and their Sweep&Go entry, as the wizard's own "Schedule Service" button builds it. */
export function continueUrlFor(lead: QuoteLead, s: RecoverySettings, sub?: WizardSubmission | null): string {
  const q = new URLSearchParams();
  const put = (k: string, v: string | null | undefined) => { if (v) q.set(k, v); };
  put("zip_code", lead.zipCode);
  put("number_of_dogs", lead.numberOfDogs);
  put("clean_up_frequency", lead.frequency);
  put("last_time_yard_was_thoroughly_cleaned", lead.lastCleaned);
  const parts = (lead.firstName || "").trim().split(/\s+/);
  put("first_name", parts[0]);
  put("last_name", lead.lastName || parts.slice(1).join(" "));
  put("coupon_code", s.coupon);
  put("cell_phone_number", digits(lead.phone));
  put("your_email_address", lead.email);
  put("dgs_entry", lead.sngEntryId || sub?.sngEntryId);
  put("dgs_sub", sub?.sngSubmissionId);
  return `${s.scheduleUrl}?${q.toString()}`;
}

export const FREQUENCY_LABEL: Record<string, string> = {
  once_a_week: "once a week", weekly: "once a week", two_times_a_week: "twice a week", bi_weekly: "every two weeks", biweekly: "every two weeks",
  once_a_month: "once a month", monthly: "once a month", one_time: "one-time cleanup", onetime: "one-time cleanup",
};

export type ResumeResolution =
  | { ok: true; lead: QuoteLead; continueUrl: string; expiresAt: Date | null; quotedPrice: string | null }
  | { ok: false; reason: "not_found" | "disabled" | "expired" | "signed_up"; quoteUrl: string };

export async function resolveResume(code: string): Promise<ResumeResolution> {
  const s = await recoverySettings();
  const lead = await prisma.quoteLead.findUnique({ where: { resumeCode: code.toUpperCase() } });
  if (!lead) return { ok: false, reason: "not_found", quoteUrl: s.quoteUrl };
  if (lead.resumeDisabled) return { ok: false, reason: "disabled", quoteUrl: s.quoteUrl };
  if (lead.status === "CONVERTED" || lead.convertedAt) return { ok: false, reason: "signed_up", quoteUrl: s.quoteUrl };
  const expiresAt = linkExpiresAt(lead, s);
  if (expiresAt && expiresAt < new Date()) return { ok: false, reason: "expired", quoteUrl: s.quoteUrl };
  const sub = await wizardSubmissionFor(lead);
  // Keep the entry id on the lead once we've seen it, so the card and stats can show it.
  if (!lead.sngEntryId && sub?.sngEntryId) await prisma.quoteLead.update({ where: { id: lead.id }, data: { sngEntryId: sub.sngEntryId } }).catch(() => {});
  return { ok: true, lead, continueUrl: continueUrlFor(lead, s, sub), expiresAt, quotedPrice: sub?.quotedPrice ?? null };
}

/** The lead opened their link: count it, remember the channel, note it on the timeline (once per 6 h). */
export async function recordResumeOpen(leadId: string, channel: ResumeChannel): Promise<void> {
  const now = new Date();
  await prisma.quoteLead.update({
    where: { id: leadId },
    data: { resumeOpenCount: { increment: 1 }, resumeLastOpenedAt: now, resumeChannel: channel, lastActivityAt: now, resumeOpenedAt: (await prisma.quoteLead.findUnique({ where: { id: leadId }, select: { resumeOpenedAt: true } }))?.resumeOpenedAt ?? now },
  });
  const message = `🔗 Opened their resume link${channel === "sms" ? " from a text" : channel === "email" ? " from an email" : ""}.`;
  const recent = await prisma.leadUpdate.findFirst({ where: { leadType: "QUOTE_FORM", leadId, message: { startsWith: "🔗 Opened their resume link" }, createdAt: { gt: new Date(Date.now() - 6 * 3600_000) } }, select: { id: true } });
  if (!recent) await prisma.leadUpdate.create({ data: { leadType: "QUOTE_FORM", leadId, message, communicationType: "other", adminEmail: "system" } });
}

export interface RecoveryStats {
  days: number; started: number; signedUp: number; abandoned: number; returned: number; recovered: number;
  recoveryRate: number | null; byChannel: Record<string, number>;
}

/** Quotes started / signed up / abandoned / recovered over the last N days (Sweep&Go quote leads only). */
export async function recoveryStats(days: number, s?: RecoverySettings): Promise<RecoveryStats> {
  const settings = s ?? (await recoverySettings());
  const since = new Date(Date.now() - days * 86_400_000);
  const leads = await prisma.quoteLead.findMany({
    where: { createdAt: { gte: since }, ...SNG_QUOTE_WHERE },
    select: { status: true, archived: true, convertedAt: true, resumeOpenedAt: true, createdAt: true, resumeChannel: true },
  });
  const window = settings.abandonMinutes * 60_000;
  const now = Date.now();
  let signedUp = 0, abandoned = 0, returned = 0, recovered = 0;
  const byChannel: Record<string, number> = {};
  for (const l of leads) {
    const converted = l.status === "CONVERTED" || !!l.convertedAt;
    if (converted) signedUp++;
    // Abandoned = past the window without a signup inside it (a later signup is a recovery).
    const signedInWindow = converted && l.convertedAt ? l.convertedAt.getTime() - l.createdAt.getTime() <= window : false;
    const pastWindow = now - l.createdAt.getTime() > window;
    if (pastWindow && !signedInWindow) {
      abandoned++;
      if (l.resumeOpenedAt) returned++;
      if (converted && l.resumeOpenedAt) { recovered++; const ch = l.resumeChannel || "other"; byChannel[ch] = (byChannel[ch] || 0) + 1; }
    }
  }
  return { days, started: leads.length, signedUp, abandoned, returned, recovered, recoveryRate: abandoned ? recovered / abandoned : null, byChannel };
}
