import prisma from "@/lib/prisma";
import type { LeadSource } from "@prisma/client";

/**
 * Duplicate-lead detection + merge. Leads are "duplicates" when they share a
 * phone number (normalized to last-10 digits). Detection spans all lead types;
 * merge consolidates same-type duplicates into one survivor, preserving all
 * data (fills blanks, concatenates notes, moves messages/updates/history).
 */

export type WireLeadType = "quote" | "outofarea" | "career" | "commercial" | "adlead";

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

function phoneCandidates(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const digits = String(raw).replace(/\D/g, "");
  const ten = digits.slice(-10);
  if (ten.length !== 10) return raw ? [raw] : [];
  const a = ten.slice(0, 3), m = ten.slice(3, 6), l = ten.slice(6);
  return [`+1${ten}`, ten, `1${ten}`, `(${a}) ${m}-${l}`, `${a}-${m}-${l}`, `${a}.${m}.${l}`];
}

export interface DuplicateLead {
  leadType: WireLeadType;
  id: string;
  name: string;
  phone: string;
  status: string | null;
  createdAt: string;
  url: string;
  mergeable: boolean; // same type as the lead being viewed → can be merged in
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

/** All OTHER leads (any type) sharing this lead's phone. */
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
        url: `/admin/${pathMap[leadType]}/${r.id}`, mergeable: leadType === wire,
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

// Fields to fill on the survivor from duplicates when the survivor's is blank.
const FILLABLE: Record<"quote" | "adlead", string[]> = {
  quote: ["firstName", "lastName", "email", "address", "city", "zipCode", "numberOfDogs", "frequency", "lastCleaned", "gateLocation", "gateCode", "grade", "followupDate", "dogsInfo"],
  adlead: ["firstName", "lastName", "fullName", "email", "city", "state", "zipCode", "adSource", "campaignName", "adSetName", "adName", "formName", "grade", "followupDate", "customFields"],
};

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

/**
 * Merge same-type duplicate leads into `survivorId`. Fills blank survivor
 * fields from duplicates, concatenates all notes, moves messages/updates/
 * activity to the survivor, then deletes the merged duplicate records.
 */
export async function mergeLeads(
  wire: "quote" | "adlead",
  survivorId: string,
  mergeIds: string[]
): Promise<{ merged: number }> {
  const model = wire === "quote" ? prisma.quoteLead : prisma.adLead;
  const source = leadTypeMap[wire];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const survivor = (await (model as any).findUnique({ where: { id: survivorId } })) as Record<string, unknown> | null;
  if (!survivor) throw new Error("Survivor lead not found");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dups = (await (model as any).findMany({ where: { id: { in: mergeIds } } })) as Array<Record<string, unknown>>;
  if (dups.length === 0) return { merged: 0 };
  // Oldest first, so the earliest data wins when filling blanks.
  dups.sort((a, b) => (new Date(a.createdAt as string) < new Date(b.createdAt as string) ? -1 : 1));

  const data: Record<string, unknown> = {};
  for (const f of FILLABLE[wire]) {
    if (isBlank(survivor[f])) {
      const fromDup = dups.find((d) => !isBlank(d[f]));
      if (fromDup) data[f] = fromDup[f];
    }
  }
  // Notes: keep everything (survivor + each duplicate), de-duplicated.
  const allNotes = [survivor.notes as string | null, ...dups.map((d) => d.notes as string | null)]
    .map((n) => (n || "").trim())
    .filter(Boolean);
  const uniqueNotes = [...new Set(allNotes)];
  if (uniqueNotes.length) data.notes = uniqueNotes.join("\n---\n");

  // Apply merged fields, move sub-records, delete duplicates — atomically.
  await prisma.$transaction([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (model as any).update({ where: { id: survivorId }, data }),
    prisma.leadMessage.updateMany({ where: { leadType: source, leadId: { in: mergeIds } }, data: { leadId: survivorId } }),
    prisma.leadUpdate.updateMany({ where: { leadType: source, leadId: { in: mergeIds } }, data: { leadId: survivorId } }),
    prisma.activityLog.updateMany({ where: { leadType: source, leadId: { in: mergeIds } }, data: { leadId: survivorId } }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (model as any).deleteMany({ where: { id: { in: mergeIds } } }),
  ]);

  return { merged: dups.length };
}
