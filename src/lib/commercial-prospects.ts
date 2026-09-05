import prisma from "@/lib/prisma";
import { flatten, makePicker } from "@/lib/form-payload";

export { PROSPECT_TYPES, PROSPECT_TYPE_LABEL, PROSPECT_STATUSES } from "@/lib/commercial-prospect-types";
export type { ProspectType, ProspectStatus } from "@/lib/commercial-prospect-types";
import type { ProspectType } from "@/lib/commercial-prospect-types";

export const phoneKey = (p: string | null | undefined) => { const d = (p || "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : ""; };

export function normalizeType(raw: string): ProspectType {
  const t = raw.toLowerCase();
  if (/hoa|homeowner|association|condo/.test(t)) return "HOA";
  if (/apart|complex|multi/.test(t)) return "APARTMENTS";
  if (/55|senior|retire|active adult|age.?restricted/.test(t)) return "SENIOR_55";
  return "OTHER";
}

export interface ProspectInput {
  propertyName: string; propertyType: ProspectType; contactName: string | null; phone: string | null; email: string | null;
  city: string; state: string; zipCode: string; units: number | null; notes: string | null; source: string | null;
}

/** Map one loosely-keyed row (CSV row, form body) to a prospect. Returns null when the essentials are missing. */
export function rowToProspect(row: unknown): { input: ProspectInput | null; missing: string[] } {
  const { pick } = makePicker(flatten(row));
  // Order matters: each column is consumed once, so the specific columns
  // ("Property Type", "Contact Name") are claimed before the broad name match.
  const typeRaw = pick([/^propertytype$/, /^communitytype$/, /^type$/, /type$/, /category/, /kind/]);
  const contactName = pick([/^contactname$/, /^contact$/, /contact/, /manager/, /management/, /^fullname$/]);
  const phone = pick([/^phone$/, /phone/, /mobile/, /cell/, /^tel/]);
  const email = pick([/^email$/, /email/]);
  const propertyName = pick([/^propertyname$/, /^property$/, /^community$/, /^name$/, /property/, /community/, /hoa/, /complex/, /business/, /company/, /^(?!.*(first|last)).*name/]);
  const city = pick([/^city$/, /town/]);
  const state = pick([/^state$/]) || "CA";
  const zipCode = pick([/^zipcode$/, /^zip$/, /zip/, /postal/]);
  const unitsRaw = pick([/^units$/, /^#?(of|no|num|number)?(of)?units$/, /units$/, /^(number|no|num)ofunits/, /homes$/, /doors$/, /^unitcount$/]);
  const notes = pick([/^notes$/, /note/, /comment/, /details/]);
  const source = pick([/^source$/, /found/, /^url$/, /link/, /website/]);
  const missing = Object.entries({ propertyName, city, zipCode }).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) return { input: null, missing };
  const units = parseInt(unitsRaw.replace(/\D/g, ""), 10);
  return { input: { propertyName, propertyType: normalizeType(typeRaw || propertyName), contactName: contactName || null, phone: phone || null, email: email || null,
    city, state: state.toUpperCase().slice(0, 2), zipCode: zipCode.replace(/\D/g, "").slice(0, 5) || zipCode, units: isFinite(units) && units > 0 ? units : null, notes: notes || null, source: source || null }, missing: [] };
}

/** Import many rows. Skips exact duplicates already on the list and anything that is already a commercial lead. */
export async function importProspects(rows: unknown[]) {
  const existing = await prisma.commercialProspect.findMany({ select: { phone: true, propertyName: true, zipCode: true } });
  const leads = await prisma.commercialLead.findMany({ select: { phone: true } });
  const seenPhone = new Set(existing.map((e) => phoneKey(e.phone)).filter(Boolean));
  const seenProp = new Set(existing.map((e) => e.propertyName.toLowerCase().trim() + "|" + e.zipCode));
  const leadPhones = new Set(leads.map((l) => phoneKey(l.phone)).filter(Boolean));
  const result = { created: 0, skipped: [] as { row: number; reason: string; name: string }[] };
  for (let i = 0; i < rows.length; i++) {
    const { input, missing } = rowToProspect(rows[i]);
    if (!input) { result.skipped.push({ row: i + 1, reason: "missing " + missing.join(", "), name: "" }); continue; }
    const pk = phoneKey(input.phone); const prop = input.propertyName.toLowerCase().trim() + "|" + input.zipCode;
    if (pk && leadPhones.has(pk)) { result.skipped.push({ row: i + 1, reason: "already a commercial lead", name: input.propertyName }); continue; }
    if ((pk && seenPhone.has(pk)) || seenProp.has(prop)) { result.skipped.push({ row: i + 1, reason: "already on the call list", name: input.propertyName }); continue; }
    await prisma.commercialProspect.create({ data: input });
    result.created++; if (pk) seenPhone.add(pk); seenProp.add(prop);
  }
  return result;
}
