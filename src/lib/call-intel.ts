import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { LeadSource } from "@prisma/client";
import prisma from "@/lib/prisma";
import { quoFetch, getQuoFromNumber, normalizePhoneNumber } from "@/lib/quo";
import { markLeadContactedIfNew, PHONE_CALL_STEP } from "@/lib/drip";
import { notify } from "@/lib/notify";

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
  isCommercialInquiry: z
    .boolean()
    .describe("True when the caller is asking on behalf of a property or organization rather than their own home: an HOA, apartment complex, mobile-home or 55+ community, property manager, business, park, or school. False for a homeowner or renter asking about their own yard."),
  propertyName: z.string().describe("For a commercial inquiry, the name of the property, community, HOA, or company the caller represents. Empty string if never stated or not commercial."),
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

// ── Commercial calls (commercial leads + call-list prospects) ───────────────

const CommercialCallIntel = z.object({
  reachedDecisionMaker: z
    .enum(["yes", "no", "unknown"])
    .describe("yes = we spoke with someone who can approve a service contract (board member, property manager, owner, community manager); no = a gatekeeper, receptionist, leasing agent or resident with no authority; unknown = can't tell."),
  contactName: z.string().describe("Full name of the person we spoke with. Empty string if never stated."),
  contactRole: z.string().describe("Their role or title, e.g. 'property manager', 'HOA board president', 'leasing agent'. Empty string if never stated."),
  email: z.string().describe("Email address they gave for follow-up. Empty string if never stated."),
  propertyName: z.string().describe("Name of the property, community, HOA or management company as stated on the call. Empty string if never stated."),
  units: z.string().describe("Number of units, homes, or doors at the property, digits only. Empty string if never stated."),
  petPolicy: z.string().describe("What they said about pets on the property: allowed, dog park, pet stations, restrictions. Empty string if not discussed."),
  currentVendor: z.string().describe("Who currently handles pet waste or grounds cleanup, if mentioned (a vendor, landscapers, in-house staff, nobody). Empty string if not discussed."),
  painPoints: z.string().describe("Problems they described: complaints, waste on common areas, cost, unreliable vendor. Empty string if none."),
  decisionProcess: z.string().describe("How and when a decision gets made: board meeting date, budget cycle, who else must approve, need for a proposal or site visit. Empty string if not discussed."),
  interestLevel: z
    .enum(["hot", "warm", "cold", "not_interested", "unknown"])
    .describe("hot = wants a proposal or site visit now; warm = interested, needs follow-up; cold = just gathering info; not_interested = declined; unknown = can't tell."),
  objections: z.string().describe("Concerns or reasons for hesitation. Empty string if none."),
  nextStep: z.string().describe("The agreed next action, e.g. 'email proposal', 'site visit Thursday 10am', 'call back after board meeting on the 14th'. Empty string if none."),
  followUpDate: z.string().describe("If a specific follow-up date was agreed, as YYYY-MM-DD. Empty string if none."),
  summary: z.string().describe("2-3 sentence summary of the call for the record. Always fill this in."),
});
export type CommercialCallIntel = z.infer<typeof CommercialCallIntel>;

const COMMERCIAL_SYSTEM_PROMPT = `You extract details from phone call transcripts for DooGoodScoopers, a dog waste removal service in California's Inland Empire that also serves HOAs, apartment complexes, 55+ and mobile-home communities, and property management companies.

This call is with a COMMERCIAL prospect or lead: a property, community, or management company, not a homeowner. The transcript labels each line AGENT (our side) or CALLER (the property's side, whether they called us or we called them).

Rules:
- Only record what the CALLER actually stated. Never infer, guess, or carry over an example from these instructions.
- If a detail was never given, return an empty string. An empty string is always better than a wrong value.
- Transcription is imperfect. Numbers may be spoken as words; normalize them.
- Prices and service descriptions spoken by the AGENT are not caller details.
- If the call reached only voicemail, a receptionist, or a gatekeeper, say so in the summary and set reachedDecisionMaker to "no".
- Write the summary in plain past tense from our point of view, e.g. "Spoke with the community manager; they have 240 units, a dog park that residents complain about, and want a proposal emailed before the board meets on the 14th."`;

export type CommercialExtractResult =
  | { ok: true; intel: CommercialCallIntel }
  | { ok: false; reason: "not_configured" | "too_short" | "api_error"; message: string };

export async function extractCommercialCallIntel(segments: TranscriptSegment[]): Promise<CommercialExtractResult> {
  const anthropic = client();
  if (!anthropic) return { ok: false, reason: "not_configured", message: "ANTHROPIC_API_KEY is not set in this environment." };
  const callerLines = segments.filter((s) => s.speaker === "caller");
  if (segments.length < 4 || callerLines.length === 0) {
    return { ok: false, reason: "too_short", message: `Transcript too short to extract from (${segments.length} lines, ${callerLines.length} from the other party).` };
  }
  try {
    const res = await anthropic.messages.parse({
      model: "claude-opus-5",
      max_tokens: 4096,
      system: COMMERCIAL_SYSTEM_PROMPT,
      output_config: { format: zodOutputFormat(CommercialCallIntel), effort: "low" },
      messages: [{ role: "user", content: `Extract the details from this call transcript.\n\n<transcript>\n${formatTranscript(segments)}\n</transcript>` }],
    });
    if (!res.parsed_output) return { ok: false, reason: "api_error", message: `Model returned no parsed output (stop_reason: ${res.stop_reason ?? "unknown"}).` };
    return { ok: true, intel: res.parsed_output };
  } catch (e) {
    const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.error("[call-intel] commercial extraction failed:", message);
    return { ok: false, reason: "api_error", message };
  }
}

export type CommercialMatch =
  | { kind: "commercial"; id: string; name: string }
  | { kind: "prospect"; id: string; name: string };

/**
 * Is this number a commercial lead or a call-list prospect? Checked before the
 * residential tables so a property manager's call gets the commercial
 * extraction. Newest record wins when a number appears more than once.
 */
export async function findCommercialMatch(phone: string): Promise<CommercialMatch | null> {
  const candidates = phoneVariants(phone);
  const lead = await prisma.commercialLead.findFirst({ where: { phone: { in: candidates } }, orderBy: [{ archived: "asc" }, { createdAt: "desc" }], select: { id: true, propertyName: true } });
  if (lead) return { kind: "commercial", id: lead.id, name: lead.propertyName };
  const prospect = await prisma.commercialProspect.findFirst({ where: { phone: { in: candidates } }, orderBy: { createdAt: "desc" }, select: { id: true, propertyName: true } });
  if (prospect) return { kind: "prospect", id: prospect.id, name: prospect.propertyName };
  return null;
}

/** Transcript → the right extraction for who is on the other end. */
export type SmartAnalysis =
  | { kind: "commercial"; match: CommercialMatch; transcript: TranscriptSegment[]; externalNumber: string | null; result: CommercialExtractResult }
  | { kind: "residential"; match: null; transcript: TranscriptSegment[]; externalNumber: string | null; result: ExtractResult };

export async function analyzeCallSmart(callId: string, phoneHint?: string | null): Promise<SmartAnalysis | null> {
  const t = await fetchCallTranscript(callId);
  if (!t) return null;
  const external = phoneHint || t.externalNumber;
  const match = external ? await findCommercialMatch(external) : null;
  if (match) return { kind: "commercial", match, transcript: t.segments, externalNumber: t.externalNumber, result: await extractCommercialCallIntel(t.segments) };
  return { kind: "residential", match: null, transcript: t.segments, externalNumber: t.externalNumber, result: await extractCallIntel(t.segments) };
}

/**
 * Write a commercial call into its lead or prospect. Fills blanks only, logs
 * the call in the Updates timeline, and for a prospect counts the attempt and
 * moves To call / Attempted → Contacted when a real conversation happened.
 */
export async function applyCommercialCallIntel(opts: { phone: string; intel: CommercialCallIntel; callId: string; match: CommercialMatch }): Promise<ApplyResult> {
  const { intel, callId, match } = opts;
  try {
    await prisma.processedCall.create({ data: { callId, action: "processing" } });
  } catch {
    return { action: "skipped", fieldsFilled: [], reason: "this call was already processed" };
  }
  const record = async (r: ApplyResult): Promise<ApplyResult> => {
    await prisma.processedCall.update({ where: { callId }, data: { action: r.action, leadType: r.leadType ?? null, leadId: r.leadId ?? null } }).catch(() => {});
    return r;
  };
  const who = [intel.contactName, intel.contactRole].filter((x) => x.trim()).join(", ");
  const note = [
    "📞 Call notes (AI)",
    intel.summary,
    who ? `Spoke with: ${who}${intel.reachedDecisionMaker === "yes" ? " (decision-maker)" : intel.reachedDecisionMaker === "no" ? " (not the decision-maker)" : ""}` : intel.reachedDecisionMaker === "no" ? "Did not reach a decision-maker" : "",
    intel.units ? `Units: ${intel.units}` : "",
    intel.petPolicy ? `Pets: ${intel.petPolicy}` : "",
    intel.currentVendor ? `Current vendor: ${intel.currentVendor}` : "",
    intel.painPoints ? `Pain points: ${intel.painPoints}` : "",
    intel.decisionProcess ? `Decision process: ${intel.decisionProcess}` : "",
    intel.interestLevel !== "unknown" ? `Interest: ${intel.interestLevel.replace("_", " ")}` : "",
    intel.objections ? `Concerns: ${intel.objections}` : "",
    intel.nextStep ? `Next step: ${intel.nextStep}` : "",
  ].filter(Boolean).join("\n");
  const followUp = /^\d{4}-\d{2}-\d{2}$/.test(intel.followUpDate) ? new Date(intel.followUpDate + "T17:00:00Z") : null;

  if (match.kind === "commercial") {
    const lead = await prisma.commercialLead.findUnique({ where: { id: match.id } });
    if (!lead) return record({ action: "skipped", fieldsFilled: [], reason: "lead vanished" });
    const data: Record<string, unknown> = {
      contactName: fill(lead.contactName === "Unknown" ? "" : lead.contactName, intel.contactName),
      email: fill(lead.email, intel.email),
      propertyName: fill(lead.propertyName, intel.propertyName),
      followupDate: !lead.followupDate && followUp ? followUp : undefined,
    };
    const filled = Object.entries(data).filter(([, v]) => v !== undefined).map(([k]) => k);
    if (filled.length) await prisma.commercialLead.update({ where: { id: lead.id }, data });
    await prisma.leadUpdate.create({ data: { leadType: "COMMERCIAL", leadId: lead.id, message: note, communicationType: "phone_call", adminEmail: "call-ai@system" } });
    await markLeadContactedIfNew("COMMERCIAL", lead.id);
    return record({ action: filled.length ? "enriched" : "noted", leadType: "COMMERCIAL", leadId: lead.id, fieldsFilled: filled });
  }

  const p = await prisma.commercialProspect.findUnique({ where: { id: match.id } });
  if (!p) return record({ action: "skipped", fieldsFilled: [], reason: "prospect vanished" });
  const units = parseInt(intel.units.replace(/\D/g, ""), 10);
  const data: Record<string, unknown> = {
    contactName: fill(p.contactName, who || intel.contactName),
    email: fill(p.email, intel.email),
    units: !p.units && isFinite(units) && units > 0 ? units : undefined,
    followupDate: !p.followupDate && followUp ? followUp : undefined,
  };
  const filled = Object.entries(data).filter(([, v]) => v !== undefined).map(([k]) => k);
  // The call itself is an attempt; a real conversation moves the status along.
  data.attempts = { increment: 1 };
  data.lastAttemptAt = new Date();
  if (p.status === "TO_CALL" || p.status === "ATTEMPTED") data.status = intel.reachedDecisionMaker === "no" && !intel.contactName ? "ATTEMPTED" : "CONTACTED";
  await prisma.commercialProspect.update({ where: { id: p.id }, data });
  await prisma.leadUpdate.create({ data: { leadType: "COMMERCIAL_PROSPECT", leadId: p.id, message: note, communicationType: "phone_call", adminEmail: "call-ai@system" } });
  if (intel.interestLevel === "hot") {
    await notify({ type: "lead_replied", severity: "info", title: `🔥 Hot commercial prospect: ${p.propertyName}`, body: intel.nextStep || intel.summary, link: `/admin/leads/commercial/call-list/${p.id}`, push: true }).catch(() => {});
  }
  return record({ action: filled.length ? "enriched" : "noted", leadType: "COMMERCIAL_PROSPECT", leadId: p.id, fieldsFilled: filled });
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

  if (intel.isCommercialInquiry) {
    const lead = await prisma.commercialLead.create({
      data: {
        contactName: [intel.firstName, intel.lastName].filter((x) => x.trim()).join(" ").trim() || "Caller",
        propertyName: intel.propertyName.trim() || "Unknown property",
        phone, email: intel.email.trim(), city: "", state: "CA", zipCode: intel.zipCode.trim(),
        status: "PHONE_REVIEW",
        inquiry: `Created from an inbound call (Quo call ${callId}).\n\n${intel.summary}`,
      },
    });
    await timeline("COMMERCIAL", lead.id);
    await notify({ type: "lead_created", severity: "info", title: `🏢 New commercial lead from a phone call: ${lead.propertyName}`, body: intel.summary, link: `/admin/leads/commercial/${lead.id}`, push: true });
    return record({ action: "created", leadType: "COMMERCIAL", leadId: lead.id, fieldsFilled: Object.entries({ contactName: intel.firstName, propertyName: intel.propertyName, email: intel.email, zipCode: intel.zipCode }).filter(([, v]) => v.trim()).map(([k]) => k) });
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
  await notify({
    type: "lead_created",
    severity: "info",
    title: `New lead from a phone call: ${created.firstName}`,
    body: [intel.zipCode && `zip ${intel.zipCode}`, intel.numberOfDogs && `${intel.numberOfDogs} dogs`, intel.summary]
      .filter(Boolean)
      .join(" · "),
    link: `/admin/quote-leads/${created.id}`,
    push: true,
  });
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
