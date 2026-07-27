import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { LeadSource } from "@prisma/client";
import prisma from "@/lib/prisma";
import { quoFetch, getQuoFromNumber, normalizePhoneNumber } from "@/lib/quo";
import { markLeadContactedIfNew, PHONE_CALL_STEP } from "@/lib/drip";

/**
 * Call intelligence: turn a finished phone call into structured lead data.
 *
 * Quo records and transcribes every call, so after a call ends we pull the
 * transcript and have Claude extract the details the caller gave us (zip code,
 * dog count, name, what they wanted) plus a short summary. The webhook then
 * fills in blanks on the matching lead — or creates one for an unknown caller.
 *
 * Structured outputs guarantee the model returns schema-valid JSON, so nothing
 * malformed can reach the database. Unknown values come back as empty strings
 * rather than null/omitted, which keeps the schema strict-mode friendly.
 */

// ── Transcript ──────────────────────────────────────────────────────────────

export interface TranscriptSegment {
  speaker: "us" | "caller";
  text: string;
}

interface QuoDialogueEntry {
  content?: string;
  identifier?: string;
  userId?: string | null;
}

export interface CallTranscript {
  segments: TranscriptSegment[];
  /**
   * The other party's number, derived from the dialogue itself. Quo's transcript
   * webhook payload carries only callId/createdAt/dialogue — no from/to — so the
   * caller must be recovered from the speaker identifiers or we have no one to
   * attach the lead to.
   */
  externalNumber: string | null;
}

/** Pull a call's transcript from Quo, label each line by speaker, and identify the caller. */
export async function fetchCallTranscript(callId: string): Promise<CallTranscript | null> {
  const res = await quoFetch(`/call-transcripts/${encodeURIComponent(callId)}`);
  if (!res.ok) return null;
  const dialogue = ((res.data as { data?: { dialogue?: QuoDialogueEntry[] } })?.data?.dialogue) || [];
  if (dialogue.length === 0) return null;

  const ours = normalizePhoneNumber(getQuoFromNumber());
  let externalNumber: string | null = null;

  const segments = dialogue
    .filter((d) => (d.content || "").trim())
    .map((d) => {
      const from = normalizePhoneNumber(d.identifier || "");
      // Anything spoken from our own number (or by a logged-in Quo user) is us.
      const isUs = (!!ours && from === ours) || !!d.userId;
      if (!isUs && from && from !== ours && !externalNumber) externalNumber = from;
      return { speaker: isUs ? ("us" as const) : ("caller" as const), text: (d.content || "").trim() };
    });

  return { segments, externalNumber };
}

/** Quo's own AI summary for a call, when available. */
export async function fetchCallSummary(callId: string): Promise<string | null> {
  const res = await quoFetch(`/call-summaries/${encodeURIComponent(callId)}`);
  if (!res.ok) return null;
  const summary = (res.data as { data?: { summary?: string[] } })?.data?.summary;
  return Array.isArray(summary) ? summary.join(" ") : null;
}

export function formatTranscript(segments: TranscriptSegment[]): string {
  return segments.map((s) => `${s.speaker === "us" ? "AGENT" : "CALLER"}: ${s.text}`).join("\n");
}

// ── Extraction ──────────────────────────────────────────────────────────────

const CallIntel = z.object({
  isServiceInquiry: z
    .boolean()
    .describe("True if the caller is a prospective or current customer asking about dog waste removal service. False for wrong numbers, spam, robocalls, vendors, or personal calls."),
  firstName: z.string().describe("Caller's first name only, no last name. Empty string if never stated."),
  lastName: z.string().describe("Caller's last name. Empty string if never stated."),
  email: z.string().describe("Caller's email address. Empty string if never stated."),
  zipCode: z.string().describe("5-digit US zip code the caller gave for their service address. Empty string if never stated."),
  address: z.string().describe("Street address if the caller gave one. Empty string if never stated."),
  numberOfDogs: z
    .string()
    .describe("How many dogs the caller has, as digits only (e.g. '1', '3'). Convert spoken words: 'one' -> '1'. Empty string if never stated."),
  // These two must be EXACT dropdown values from the lead edit form, or the
  // saved value matches no <option> and the field renders blank when editing.
  frequency: z
    .enum(["", "Once a week", "Twice a week", "Every other week", "One-time cleanup"])
    .describe(
      "The cleanup frequency the caller settled on. Use '' when it was not discussed or they did not decide. Map what they said onto the closest option: 'weekly'/'once a week' -> 'Once a week'; 'twice a week'/'two times a week' -> 'Twice a week'; 'biweekly'/'every two weeks'/'every other week' -> 'Every other week'; 'one time'/'just once' -> 'One-time cleanup'."
    ),
  lastCleaned: z
    .enum(["", "Less than a week", "1-2 weeks", "2-4 weeks", "1+ month", "Never/Unknown"])
    .describe(
      "How long since the caller's yard was last cleaned. Use '' when they never said. Map what they said onto the closest bucket: 'a few days'/'this week' -> 'Less than a week'; 'a week or two' -> '1-2 weeks'; 'three weeks'/'a few weeks'/'about a month' -> '2-4 weeks'; 'over a month'/'months' -> '1+ month'; 'never'/'I don't know' -> 'Never/Unknown'."
    ),
  interestLevel: z
    .enum(["hot", "warm", "cold", "not_interested", "unknown"])
    .describe("hot = ready to sign up now; warm = interested, needs follow-up; cold = just gathering info; not_interested = declined; unknown = can't tell."),
  objections: z.string().describe("Any concerns, hesitations, or reasons they did not sign up. Empty string if none."),
  nextStep: z.string().describe("The agreed next action, e.g. 'texted signup link', 'call back Tuesday'. Empty string if none."),
  summary: z.string().describe("2-3 sentence summary of the call for the lead's timeline. Always fill this in."),
});

export type CallIntel = z.infer<typeof CallIntel>;

const SYSTEM_PROMPT = `You extract lead details from phone call transcripts for DooGoodScoopers, a residential dog waste removal (pooper scooper) service in California's Inland Empire.

The transcript labels each line AGENT (our side — a human or our AI receptionist) or CALLER.

Rules:
- Only record what the CALLER actually stated. Never infer, guess, or carry over an example from these instructions.
- If a detail was never given, return an empty string. An empty string is always better than a wrong value.
- Transcription is imperfect. Zip codes and dog counts may be spoken as words or digit-by-digit ("nine two three nine four" = "92394"). Normalize them.
- Prices, service descriptions, and policies spoken by the AGENT are not caller details — ignore them.
- Write the summary in plain past tense from our point of view, e.g. "Caller asked about pricing for one dog and signed up for weekly service."`;

function client(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey ? new Anthropic({ apiKey }) : null;
}

export function isCallIntelConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export type ExtractResult =
  | { ok: true; intel: CallIntel }
  | { ok: false; reason: "not_configured" | "too_short" | "api_error"; message: string };

/**
 * Extract structured lead data from a call transcript.
 *
 * Returns a discriminated result rather than null so failures carry their real
 * cause — an API error swallowed into a console log is invisible in production
 * and makes this impossible to debug from the UI.
 */
export async function extractCallIntel(segments: TranscriptSegment[]): Promise<ExtractResult> {
  const anthropic = client();
  if (!anthropic) {
    return { ok: false, reason: "not_configured", message: "ANTHROPIC_API_KEY is not set in this environment." };
  }

  // A couple of words each way is a hang-up or voicemail beep, not a lead.
  const callerLines = segments.filter((s) => s.speaker === "caller");
  if (segments.length < 4 || callerLines.length === 0) {
    return {
      ok: false,
      reason: "too_short",
      message: `Transcript too short to extract from (${segments.length} lines, ${callerLines.length} from the caller).`,
    };
  }

  try {
    const res = await anthropic.messages.parse({
      model: "claude-opus-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      output_config: {
        format: zodOutputFormat(CallIntel),
        effort: "low", // scoped extraction — low effort is accurate and cheap here
      },
      messages: [
        {
          role: "user",
          content: `Extract the caller's details from this call transcript.\n\n<transcript>\n${formatTranscript(segments)}\n</transcript>`,
        },
      ],
    });
    if (!res.parsed_output) {
      return {
        ok: false,
        reason: "api_error",
        message: `Model returned no parsed output (stop_reason: ${res.stop_reason ?? "unknown"}).`,
      };
    }
    return { ok: true, intel: res.parsed_output };
  } catch (e) {
    const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.error("[call-intel] extraction failed:", message);
    return { ok: false, reason: "api_error", message };
  }
}

/** Fetch + extract in one step, for a Quo call id. */
export async function analyzeCall(
  callId: string
): Promise<{ transcript: TranscriptSegment[]; externalNumber: string | null; result: ExtractResult } | null> {
  const t = await fetchCallTranscript(callId);
  if (!t) return null;
  return { transcript: t.segments, externalNumber: t.externalNumber, result: await extractCallIntel(t.segments) };
}

// ── Applying intel to the CRM ───────────────────────────────────────────────

/** Common stored formats for a US number, so we match raw-stored phones. */
export function phoneVariants(e164: string): string[] {
  const digits = e164.replace(/\D/g, "");
  const ten = digits.slice(-10);
  if (ten.length !== 10) return [e164];
  const a = ten.slice(0, 3), m = ten.slice(3, 6), l = ten.slice(6);
  return [`+1${ten}`, ten, `1${ten}`, `(${a}) ${m}-${l}`, `${a}-${m}-${l}`, `${a}.${m}.${l}`];
}

const blank = (v: string | null | undefined) => !v || !v.trim();
/** Take the AI's value only when we don't already have one. Never overwrites. */
const fill = (current: string | null | undefined, extracted: string) =>
  blank(current) && extracted.trim() ? extracted.trim() : undefined;

export interface ApplyResult {
  action: "created" | "enriched" | "noted" | "skipped";
  leadType?: LeadSource;
  leadId?: string;
  fieldsFilled: string[];
  reason?: string;
}

/**
 * Write extracted call data into the CRM.
 *
 * Only ever FILLS BLANKS on an existing lead — a value you typed is never
 * overwritten by the AI. Creating a lead for an unknown caller is gated behind
 * the "calls.ai.createLeads" setting (off by default). Either way the call
 * summary is written to the lead's timeline so the extraction is auditable.
 */
export async function applyCallIntel(opts: {
  phone: string;
  intel: CallIntel;
  callId: string;
}): Promise<ApplyResult> {
  const { phone, intel, callId } = opts;
  const candidates = phoneVariants(phone);

  // Idempotency: claim this callId before doing any writes. The primary key
  // makes this atomic, so a retried or concurrently-delivered webhook for the
  // same call loses the race and exits — no duplicate lead, no duplicate note.
  // A *different* call from the same person has a different callId and proceeds
  // normally, enriching the lead we already have.
  try {
    await prisma.processedCall.create({ data: { callId, action: "processing" } });
  } catch {
    return { action: "skipped", fieldsFilled: [], reason: "this call was already processed" };
  }
  const record = async (r: ApplyResult): Promise<ApplyResult> => {
    await prisma.processedCall
      .update({
        where: { callId },
        data: { action: r.action, leadType: r.leadType ?? null, leadId: r.leadId ?? null },
      })
      .catch(() => {});
    return r;
  };

  const note = [
    `📞 Call notes (AI)`,
    intel.summary,
    intel.interestLevel !== "unknown" ? `Interest: ${intel.interestLevel.replace("_", " ")}` : "",
    intel.objections ? `Concerns: ${intel.objections}` : "",
    intel.nextStep ? `Next step: ${intel.nextStep}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const timeline = (leadType: LeadSource, leadId: string) =>
    prisma.leadUpdate.create({
      data: { leadType, leadId, message: note, communicationType: "phone_call", adminEmail: "call-ai@system" },
    });

  // 1) Existing quote lead?
  const quote = await prisma.quoteLead.findFirst({
    where: { phone: { in: candidates } },
    orderBy: { createdAt: "desc" },
  });
  if (quote) {
    const data = {
      firstName: fill(quote.firstName === "Unknown" ? "" : quote.firstName, intel.firstName),
      lastName: fill(quote.lastName, intel.lastName),
      email: fill(quote.email, intel.email),
      zipCode: fill(quote.zipCode, intel.zipCode),
      address: fill(quote.address, intel.address),
      numberOfDogs: fill(quote.numberOfDogs, intel.numberOfDogs),
      frequency: fill(quote.frequency, intel.frequency),
      lastCleaned: fill(quote.lastCleaned, intel.lastCleaned),
    };
    const filled = Object.entries(data).filter(([, v]) => v !== undefined).map(([k]) => k);
    if (filled.length) await prisma.quoteLead.update({ where: { id: quote.id }, data });
    await timeline("QUOTE_FORM", quote.id);
    await markLeadContactedIfNew("QUOTE_FORM", quote.id);
    return record({ action: filled.length ? "enriched" : "noted", leadType: "QUOTE_FORM", leadId: quote.id, fieldsFilled: filled });
  }

  // 2) Existing ad lead?
  const ad = await prisma.adLead.findFirst({
    where: { phone: { in: candidates } },
    orderBy: { createdAt: "desc" },
  });
  if (ad) {
    const data = {
      firstName: fill(ad.firstName, intel.firstName),
      lastName: fill(ad.lastName, intel.lastName),
      email: fill(ad.email, intel.email),
      zipCode: fill(ad.zipCode, intel.zipCode),
    };
    const filled = Object.entries(data).filter(([, v]) => v !== undefined).map(([k]) => k);
    if (filled.length) await prisma.adLead.update({ where: { id: ad.id }, data });
    await timeline("AD_LEAD", ad.id);
    await markLeadContactedIfNew("AD_LEAD", ad.id);
    return record({ action: filled.length ? "enriched" : "noted", leadType: "AD_LEAD", leadId: ad.id, fieldsFilled: filled });
  }

  // 3) Unknown caller — create a lead only if it was a real service inquiry.
  if (!intel.isServiceInquiry) {
    return record({ action: "skipped", fieldsFilled: [], reason: "not a service inquiry" });
  }
  // An existing customer calling in is not a new lead.
  const customer = await prisma.sweepandgoCustomer.findFirst({
    where: { active: true, OR: [{ cellPhone: { in: candidates } }, { homePhone: { in: candidates } }] },
    select: { id: true },
  });
  if (customer) {
    await timeline("CUSTOMER", customer.id);
    return record({ action: "noted", leadType: "CUSTOMER", leadId: customer.id, fieldsFilled: [], reason: "existing customer" });
  }
  const createEnabled =
    (await prisma.appSetting.findUnique({ where: { key: "calls.ai.createLeads" } }))?.value === "true";
  if (!createEnabled) {
    return record({ action: "skipped", fieldsFilled: [], reason: "lead creation from calls is off" });
  }

  const created = await prisma.quoteLead.create({
    data: {
      firstName: intel.firstName.trim() || "Caller",
      lastName: intel.lastName.trim() || null,
      email: intel.email.trim() || null,
      phone,
      zipCode: intel.zipCode.trim(),
      address: intel.address.trim() || null,
      numberOfDogs: intel.numberOfDogs.trim() || null,
      frequency: intel.frequency.trim() || null,
      lastCleaned: intel.lastCleaned.trim() || null,
      // Lands in the "Phone Review Leads" column for a human to verify the AI's
      // extraction and fill anything the call didn't cover.
      status: "PHONE_REVIEW",
      lastStep: PHONE_CALL_STEP,
      notes: `Created from an inbound call (Quo call ${callId}).`,
    },
  });
  await timeline("QUOTE_FORM", created.id);
  return record({
    action: "created",
    leadType: "QUOTE_FORM",
    leadId: created.id,
    fieldsFilled: Object.entries({
      firstName: intel.firstName, lastName: intel.lastName, email: intel.email, zipCode: intel.zipCode,
      address: intel.address, numberOfDogs: intel.numberOfDogs, frequency: intel.frequency,
      lastCleaned: intel.lastCleaned,
    }).filter(([, v]) => v.trim()).map(([k]) => k),
  });
}
