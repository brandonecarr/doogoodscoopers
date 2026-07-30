import prisma from "@/lib/prisma";
import type { LeadSource } from "@prisma/client";

/**
 * Duplicate-lead detection + merge. Leads are "duplicates" when they share a
 * phone number (normalized to last-10 digits). Detection spans all lead types.
 *
 * Consolidation is CROSS-TYPE for the two residential-prospect types (a Quote
 * and an Ad Lead for the same person are the same lead): everything merges into
 * one survivor — the richest record (a Quote outranks an Ad Lead), keeping the
 * earliest first-contact date, filling blank fields, carrying type-specific
 * data into notes, and moving all messages / updates / activity / drip
 * enrollment / call history. Out-of-area, commercial, and career leads are
 * detected and linked but never auto-merged (different intent — e.g. a job
 * applicant who happens to share a phone with a customer).
 */

export type WireLeadType = "quote" | "outofarea" | "career" | "commercial" | "adlead";

/** Lead types that represent the same residential prospect and can be merged together. */
export type ProspectType = "quote" | "adlead";

export const leadTypeMap: Record<WireLeadType, LeadSource> = {
  quote: "QUOTE_FORM",
  outofarea: "OUT_OF_AREA",
  career: "CAREERS",
  commercial: "COMMERCIAL",
  adlead: "AD_LEAD",
};

const pathMap: Record<WireLeadType, string> = {
  quote: "quote-leads",
  outofarea: "out-of-area",
  career: "careers",
  commercial: "commercial",
  adlead: "ad-leads",
};

// A Quote holds the most (service details, grade) so it wins as the survivor.
const RICHNESS: Record<ProspectType, number> = { quote: 2, adlead: 1 };
const PROSPECT_TYPES: ProspectType[] = ["quote", "adlead"];
const isProspect = (t: WireLeadType): t is ProspectType => t === "quote" || t === "adlead";

const sourceEnum: Record<ProspectType, LeadSource> = { quote: "QUOTE_FORM", adlead: "AD_LEAD" };
const label: Record<ProspectType, string> = { quote: "Quote", adlead: "Ad Lead" };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modelFor = (t: ProspectType): any => (t === "quote" ? prisma.quoteLead : prisma.adLead);

export function prospectUrl(type: ProspectType, id: string): string {
  return `/admin/${pathMap[type]}/${id}`;
}

function phoneCandidates(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const digits = String(raw).replace(/\D/g, "");
  const ten = digits.slice(-10);
  if (ten.length !== 10) return raw ? [raw] : [];
  const a = ten.slice(0, 3), m = ten.slice(3, 6), l = ten.slice(6);
  return [`+1${ten}`, ten, `1${ten}`, `(${a}) ${m}-${l}`, `${a}-${m}-${l}`, `${a}.${m}.${l}`];
}

export interface ProspectRef {
  type: ProspectType;
  id: string;
  createdAt: Date;
}

export interface DuplicateLead {
  leadType: WireLeadType;
  id: string;
  name: string;
  phone: string;
  status: string | null;
  createdAt: string;
  url: string;
  mergeable: boolean; // prospect type (quote/adlead) → can be auto-merged
}

async function getPhone(wire: WireLeadType, id: string): Promise<string | null> {
  switch (wire) {
    case "quote": return (await prisma.quoteLead.findUnique({ where: { id }, select: { phone: true } }))?.phone ?? null;
    case "adlead": return (await prisma.adLead.findUnique({ where: { id }, select: { phone: true } }))?.phone ?? null;
    case "outofarea": return (await prisma.outOfAreaLead.findUnique({ where: { id }, select: { phone: true } }))?.phone ?? null;
    case "commercial": return (await prisma.commercialLead.findUnique({ where: { id }, select: { phone: true } }))?.phone ?? null;
    case "career": return (await prisma.careerApplication.findUnique({ where: { id }, select: { phone: true } }))?.phone ?? null;
  }
}

/** All prospect leads (quote + adlead) that share this phone number. */
export async function findProspectLeadsByPhone(phone: string | null | undefined): Promise<ProspectRef[]> {
  const candidates = phoneCandidates(phone);
  if (candidates.length === 0) return [];
  const where = { phone: { in: candidates } };
  const [quotes, ads] = await Promise.all([
    prisma.quoteLead.findMany({ where, select: { id: true, createdAt: true } }),
    prisma.adLead.findMany({ where, select: { id: true, createdAt: true } }),
  ]);
  const out: ProspectRef[] = [];
  for (const q of quotes) out.push({ type: "quote", id: q.id, createdAt: q.createdAt });
  for (const a of ads) out.push({ type: "adlead", id: a.id, createdAt: a.createdAt });
  return out;
}

/** The record that should survive a merge: richest type, then earliest created. */
export function pickSurvivor(refs: ProspectRef[]): ProspectRef | null {
  if (refs.length === 0) return null;
  return [...refs].sort(
    (a, b) => RICHNESS[b.type] - RICHNESS[a.type] || a.createdAt.getTime() - b.createdAt.getTime()
  )[0];
}

/** All OTHER leads (any type) sharing this lead's phone — for the duplicate banner. */
export async function findDuplicates(wire: WireLeadType, id: string): Promise<DuplicateLead[]> {
  const phone = await getPhone(wire, id);
  const candidates = phoneCandidates(phone);
  if (candidates.length === 0) return [];
  const where = { phone: { in: candidates } };
  const out: DuplicateLead[] = [];

  const [quotes, ads, ooa, comm] = await Promise.all([
    prisma.quoteLead.findMany({ where, select: { id: true, firstName: true, lastName: true, phone: true, status: true, createdAt: true } }),
    prisma.adLead.findMany({ where, select: { id: true, firstName: true, lastName: true, fullName: true, phone: true, status: true, createdAt: true } }),
    prisma.outOfAreaLead.findMany({ where, select: { id: true, firstName: true, lastName: true, phone: true, status: true, createdAt: true } }),
    prisma.commercialLead.findMany({ where, select: { id: true, contactName: true, phone: true, status: true, createdAt: true } }),
  ]);

  const add = (leadType: WireLeadType, rows: Array<{ id: string; name: string; phone: string | null; status: string | null; createdAt: Date }>) => {
    for (const r of rows) {
      if (leadType === wire && r.id === id) continue; // exclude self
      out.push({
        leadType, id: r.id, name: r.name || "Unknown", phone: r.phone || "",
        status: r.status, createdAt: r.createdAt.toISOString(),
        url: `/admin/${pathMap[leadType]}/${r.id}`, mergeable: isProspect(leadType),
      });
    }
  };
  add("quote", quotes.map((r) => ({ id: r.id, name: [r.firstName, r.lastName].filter(Boolean).join(" "), phone: r.phone, status: r.status, createdAt: r.createdAt })));
  add("adlead", ads.map((r) => ({ id: r.id, name: r.fullName || [r.firstName, r.lastName].filter(Boolean).join(" "), phone: r.phone, status: r.status, createdAt: r.createdAt })));
  add("outofarea", ooa.map((r) => ({ id: r.id, name: [r.firstName, r.lastName].filter(Boolean).join(" "), phone: r.phone, status: r.status, createdAt: r.createdAt })));
  add("commercial", comm.map((r) => ({ id: r.id, name: r.contactName, phone: r.phone, status: r.status, createdAt: r.createdAt })));

  out.sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1));
  return out;
}

// Fields to fill on the survivor from a source when the survivor's is blank.
const FILL_FIELDS: Record<ProspectType, string[]> = {
  quote: ["firstName", "lastName", "email", "address", "city", "zipCode", "numberOfDogs", "frequency", "lastCleaned", "gateLocation", "gateCode", "grade", "followupDate", "dogsInfo"],
  adlead: ["firstName", "lastName", "fullName", "email", "city", "state", "zipCode", "adSource", "campaignName", "adSetName", "adName", "formName", "grade", "followupDate", "customFields"],
};

// Type-specific fields that have no column on the OTHER type → preserved in notes.
const CARRYOVER_FIELDS: Record<ProspectType, string[]> = {
  adlead: ["fullName", "state", "adSource", "campaignName", "adSetName", "adName", "formName"],
  quote: ["address", "numberOfDogs", "frequency", "lastCleaned", "gateLocation", "gateCode", "lastStep"],
};

const FIELD_LABEL: Record<string, string> = {
  fullName: "Full name", state: "State", adSource: "Ad source", campaignName: "Campaign",
  adSetName: "Ad set", adName: "Ad", formName: "Form", address: "Address",
  numberOfDogs: "Dogs", frequency: "Frequency", lastCleaned: "Last cleaned",
  gateLocation: "Gate location", gateCode: "Gate code", lastStep: "Last step",
};

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

/** A readable notes block preserving a source's type-specific fields on the survivor. */
function carryoverNote(survivorType: ProspectType, srcType: ProspectType, src: Record<string, unknown>): string | null {
  if (srcType === survivorType) return null; // same type → fields already have a home
  const parts: string[] = [];
  for (const f of CARRYOVER_FIELDS[srcType]) {
    if (!isBlank(src[f])) parts.push(`${FIELD_LABEL[f] || f}: ${String(src[f])}`);
  }
  const custom = src.customFields;
  if (srcType === "adlead" && custom && typeof custom === "object") {
    for (const [k, v] of Object.entries(custom as Record<string, unknown>)) {
      if (!isBlank(v) && k !== "numberOfDogs") parts.push(`${k}: ${String(v)}`);
    }
  }
  if (parts.length === 0) return null;
  const when = src.createdAt instanceof Date ? src.createdAt.toLocaleDateString("en-US") : "";
  return `— Merged from ${label[srcType]}${when ? ` (${when})` : ""} —\n${parts.join("\n")}`;
}

/**
 * Consolidate one or more source leads into a single survivor, preserving ALL
 * data. Works across the prospect types (quote ↔ adlead). Fills blank survivor
 * fields, carries type-specific data + notes over, backdates the survivor to the
 * earliest first-contact date, moves every polymorphic sub-record (messages,
 * updates, activity, drip recipients, processed calls), then deletes the
 * sources — atomically.
 */
export async function consolidateProspects(
  survivorRef: ProspectRef,
  sourceRefs: ProspectRef[]
): Promise<{ merged: number }> {
  const sources = sourceRefs.filter((s) => !(s.type === survivorRef.type && s.id === survivorRef.id));
  if (sources.length === 0) return { merged: 0 };

  const survivorType = survivorRef.type;
  const survivor = (await modelFor(survivorType).findUnique({ where: { id: survivorRef.id } })) as Record<string, unknown> | null;
  if (!survivor) throw new Error("Survivor lead not found");

  // Load each source's full record (skip any that vanished).
  const loaded: Array<{ ref: ProspectRef; rec: Record<string, unknown> }> = [];
  for (const ref of sources) {
    const rec = (await modelFor(ref.type).findUnique({ where: { id: ref.id } })) as Record<string, unknown> | null;
    if (rec) loaded.push({ ref, rec });
  }
  if (loaded.length === 0) return { merged: 0 };
  // Oldest first, so the earliest data wins when filling blanks.
  loaded.sort((a, b) => (a.rec.createdAt as Date).getTime() - (b.rec.createdAt as Date).getTime());

  // Fill blank survivor fields from sources (oldest first).
  const data: Record<string, unknown> = {};
  for (const f of FILL_FIELDS[survivorType]) {
    if (!isBlank(survivor[f])) continue;
    const from = loaded.find(({ rec }) => !isBlank(rec[f]));
    if (from) data[f] = from.rec[f];
  }
  // If the survivor still has no first name but a source carries a full name, split it.
  if (survivorType === "quote" && isBlank(survivor.firstName) && isBlank(data.firstName)) {
    const withFull = loaded.find(({ rec }) => !isBlank(rec.fullName));
    if (withFull) {
      const parts = String(withFull.rec.fullName).trim().split(/\s+/);
      data.firstName = parts[0];
      if (parts.length > 1 && isBlank(survivor.lastName)) data.lastName = parts.slice(1).join(" ");
    }
  }

  // Notes: survivor's + each source's, plus a carryover block for cross-type extras.
  const noteChunks: string[] = [survivor.notes as string | null || ""];
  for (const { ref, rec } of loaded) {
    noteChunks.push((rec.notes as string | null) || "");
    const carry = carryoverNote(survivorType, ref.type, rec);
    if (carry) noteChunks.push(carry);
  }
  const uniqueNotes = [...new Set(noteChunks.map((n) => n.trim()).filter(Boolean))];
  if (uniqueNotes.length) data.notes = uniqueNotes.join("\n---\n");

  // Backdate to the earliest first-contact date across all merged records.
  const earliest = [survivor.createdAt as Date, ...loaded.map(({ rec }) => rec.createdAt as Date)]
    .reduce((min, d) => (d.getTime() < min.getTime() ? d : min));
  if ((survivor.createdAt as Date).getTime() !== earliest.getTime()) data.createdAt = earliest;

  const survivorEnum = sourceEnum[survivorType];

  // Move drip enrollments, respecting the (campaignId, leadType, leadId) unique
  // constraint: if the survivor is already enrolled in a campaign, drop the
  // duplicate source enrollment instead of colliding.
  const survivorRecips = await prisma.campaignRecipient.findMany({
    where: { leadType: survivorEnum, leadId: survivorRef.id },
    select: { campaignId: true },
  });
  const survivorCampaigns = new Set(survivorRecips.map((r) => r.campaignId));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: any[] = [modelFor(survivorType).update({ where: { id: survivorRef.id }, data })];

  for (const { ref } of loaded) {
    const srcEnum = sourceEnum[ref.type];
    const move = { leadType: srcEnum, leadId: ref.id };
    const to = { leadType: survivorEnum, leadId: survivorRef.id };
    ops.push(prisma.leadMessage.updateMany({ where: move, data: to }));
    ops.push(prisma.leadUpdate.updateMany({ where: move, data: to }));
    ops.push(prisma.activityLog.updateMany({ where: move, data: to }));
    ops.push(prisma.processedCall.updateMany({ where: move, data: to }));

    const srcRecips = await prisma.campaignRecipient.findMany({ where: move, select: { id: true, campaignId: true } });
    for (const cr of srcRecips) {
      if (survivorCampaigns.has(cr.campaignId)) {
        ops.push(prisma.campaignRecipient.delete({ where: { id: cr.id } }));
      } else {
        ops.push(prisma.campaignRecipient.update({ where: { id: cr.id }, data: to }));
        survivorCampaigns.add(cr.campaignId);
      }
    }
  }

  // Delete the merged sources (grouped by type).
  for (const t of PROSPECT_TYPES) {
    const ids = loaded.filter(({ ref }) => ref.type === t).map(({ ref }) => ref.id);
    if (ids.length) ops.push(modelFor(t).deleteMany({ where: { id: { in: ids } } }));
  }

  await prisma.$transaction(ops);
  return { merged: loaded.length };
}

/**
 * Given a phone number, converge every prospect lead sharing it into one
 * survivor. Returns the survivor ref (or null if there are none). Used both at
 * lead-creation time (prevent duplicates) and by the manual merge button.
 */
export async function consolidateByPhone(phone: string | null | undefined): Promise<ProspectRef | null> {
  const refs = await findProspectLeadsByPhone(phone);
  const survivor = pickSurvivor(refs);
  if (!survivor) return null;
  const sources = refs.filter((r) => !(r.type === survivor.type && r.id === survivor.id));
  if (sources.length) await consolidateProspects(survivor, sources);
  return survivor;
}

/**
 * Backwards-compatible same-type merge used by the older merge endpoint shape.
 * Delegates to the cross-type consolidator.
 */
export async function mergeLeads(
  wire: ProspectType,
  survivorId: string,
  mergeIds: string[]
): Promise<{ merged: number }> {
  const survivor = (await modelFor(wire).findUnique({ where: { id: survivorId }, select: { id: true, createdAt: true } })) as { id: string; createdAt: Date } | null;
  if (!survivor) throw new Error("Survivor lead not found");
  const sources: ProspectRef[] = mergeIds.map((id) => ({ type: wire, id, createdAt: new Date() }));
  return consolidateProspects({ type: wire, id: survivorId, createdAt: survivor.createdAt }, sources);
}
