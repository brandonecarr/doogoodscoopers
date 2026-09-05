import prisma from "@/lib/prisma";
import { flatten, makePicker } from "@/lib/form-payload";
import type { ProspectType } from "@/lib/commercial-prospect-types";

export { PROSPECT_TYPES, PROSPECT_TYPE_LABEL, PROSPECT_STATUSES } from "@/lib/commercial-prospect-types";
export type { ProspectType, ProspectStatus } from "@/lib/commercial-prospect-types";

export const phoneKey = (p: string | null | undefined) => { const d = (p || "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : ""; };
const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function normalizeType(raw: string): ProspectType {
  const t = raw.toLowerCase();
  if (/hoa|homeowner|association|condo|master/.test(t)) return "HOA";
  if (/55|senior|retire|active adult|age.?restricted|del webb|mobile home|mfd|manufactured/.test(t)) return "SENIOR_55";
  if (/apart|apt|complex|multi|villas?\b|townhome/.test(t)) return "APARTMENTS";
  return "OTHER";
}

/** "18414 Jonathan St, Adelanto 92301" → { street, city, zip } (any part may be blank). */
export function splitAddress(addr: string): { street: string; city: string; zip: string } {
  const a = addr.trim();
  const zip = (a.match(/\b(9\d{4})(?:-\d{4})?\b/) || [])[1] || "";
  const parts = a.split(",").map((s) => s.trim()).filter(Boolean);
  let city = "";
  if (parts.length >= 2) {
    // Last comma-part carries "City 92301" or "City, CA 92301"; strip state + zip.
    const tail = parts.slice(1).join(", ").replace(/\b(9\d{4})(?:-\d{4})?\b/, "").replace(/\bCA\b\.?/i, "").replace(/[,\s]+$/, "").replace(/^[,\s]+/, "").trim();
    if (tail && !/^\d/.test(tail)) city = tail.split(",")[0].trim();
  }
  return { street: parts[0] || a, city, zip };
}

export interface ProspectInput {
  propertyName: string; propertyType: ProspectType; contactName: string | null; phone: string | null; email: string | null;
  city: string; state: string; zipCode: string; address: string | null; units: number | null; notes: string | null; source: string | null;
}

/** Index/legend columns that carry no information worth keeping. */
const NOISE_KEY = /^(#|no\.?|num|index|row|id)$/i;

/**
 * Map one loosely-keyed row (spreadsheet row, form body) to a prospect.
 * Columns the model has no field for ("Pet Status", "Google Rating", "Why Call
 * First"…) are kept as "Label: value" lines in notes so research isn't lost.
 * `hint` (sheet name) breaks ties on the property type.
 */
export function rowToProspect(row: unknown, hint = ""): { input: ProspectInput | null; missing: string[] } {
  const flat = flatten(row);
  const { pick, used } = makePicker(flat);
  // Order matters: each column is consumed once, so the specific columns
  // ("Property Type", "Contact Name") are claimed before the broad name match.
  const typeRaw = pick([/^propertytype$/, /^communitytype$/, /^type$/, /type$/, /category/, /kind/]);
  const contactName = pick([/^contactname$/, /^contact$/, /contact/, /manager/, /management/, /^fullname$/]);
  const phone = pick([/^phone$/, /phone/, /mobile/, /cell/, /^tel/]);
  const email = pick([/^email$/, /email/]);
  const propertyName = pick([/^propertyname$/, /^property$/, /^community$/, /^name$/, /property/, /community/, /hoa/, /association/, /complex/, /business/, /company/, /^(?!.*(first|last)).*name/]);
  const addressRaw = pick([/^address$/, /address/, /^street/, /location/]);
  const cityRaw = pick([/^city$/, /town/]);
  const stateRaw = pick([/^state$/]);
  const zipRaw = pick([/^zipcode$/, /^zip$/, /zip/, /postal/]);
  const unitsRaw = pick([/^units$/, /^#?(of|no|num|number)?(of)?units$/, /units$/, /^(number|no|num)ofunits/, /homes$/, /doors$/, /^unitcount$/]);
  const notesRaw = pick([/^notes$/, /^note/, /comment/, /details/, /pitch/, /why/]);
  const source = pick([/^source$/, /found/, /^url$/, /link/, /website/]);

  const addr = addressRaw ? splitAddress(addressRaw) : { street: "", city: "", zip: "" };
  const city = cityRaw || addr.city;
  const zipCode = (zipRaw.replace(/\D/g, "").slice(0, 5)) || addr.zip;
  const missing = Object.entries({ propertyName, city }).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) return { input: null, missing };

  const extras = Object.entries(flat).filter(([k, v]) => !used.has(k) && v.trim() && !NOISE_KEY.test(k.trim()) && !k.startsWith("__")).map(([k, v]) => `${k.trim()}: ${v.trim()}`);
  // Free-text types ("55+ Mfd Home Park", "HOA Mgmt Co.") say more than the enum can; keep the words.
  if (typeRaw && !/^(hoa|apartments?|55\+?|senior|other)$/i.test(typeRaw.trim())) extras.unshift(`Type: ${typeRaw.trim()}`);
  const notes = [notesRaw, ...extras].filter(Boolean).join("\n") || null;
  const units = parseInt(unitsRaw.replace(/\D/g, ""), 10);
  let propertyType = normalizeType(typeRaw);
  if (propertyType === "OTHER") propertyType = normalizeType(hint);
  if (propertyType === "OTHER") propertyType = normalizeType(propertyName);
  return { input: { propertyName, propertyType, contactName: contactName || null, phone: phone || null, email: email || null,
    city, state: (stateRaw || "CA").toUpperCase().slice(0, 2), zipCode, address: addr.street || null,
    units: isFinite(units) && units > 0 ? units : null, notes, source: source || null }, missing: [] };
}

export interface ImportRow { row: unknown; hint?: string }
export interface ImportResult { created: number; merged: number; skipped: { row: number; reason: string; name: string }[] }

/**
 * Import many rows. A row that matches something already on the list (same
 * phone, or same name in the same city) MERGES into it — blank fields are
 * filled and new notes appended — because the same property often shows up on
 * a "hot list" sheet and again on its city sheet with more detail. Anything
 * that is already a commercial lead is skipped.
 */
export async function importProspects(items: ImportRow[]): Promise<ImportResult> {
  const existing = await prisma.commercialProspect.findMany();
  const leads = await prisma.commercialLead.findMany({ select: { phone: true } });
  const byPhone = new Map(existing.filter((e) => phoneKey(e.phone)).map((e) => [phoneKey(e.phone), e]));
  const byName = new Map(existing.map((e) => [nameKey(e.propertyName) + "|" + nameKey(e.city), e]));
  const leadPhones = new Set(leads.map((l) => phoneKey(l.phone)).filter(Boolean));
  const result: ImportResult = { created: 0, merged: 0, skipped: [] };

  for (let i = 0; i < items.length; i++) {
    const { input, missing } = rowToProspect(items[i].row, items[i].hint);
    if (!input) { result.skipped.push({ row: i + 1, reason: "missing " + missing.join(", "), name: "" }); continue; }
    const pk = phoneKey(input.phone); const nk = nameKey(input.propertyName) + "|" + nameKey(input.city);
    if (pk && leadPhones.has(pk)) { result.skipped.push({ row: i + 1, reason: "already a commercial lead", name: input.propertyName }); continue; }
    const match = (pk && byPhone.get(pk)) || byName.get(nk);
    if (match) {
      const fill = <T,>(cur: T | null, next: T | null) => (cur === null || cur === "" ? next : cur);
      const notes = [match.notes, input.notes].filter(Boolean).join("\n");
      const mergedNotes = input.notes && match.notes?.includes(input.notes) ? match.notes : notes || null;
      const updated = await prisma.commercialProspect.update({ where: { id: match.id }, data: {
        contactName: fill(match.contactName, input.contactName), phone: fill(match.phone, input.phone), email: fill(match.email, input.email),
        zipCode: fill(match.zipCode, input.zipCode) || "", address: fill(match.address, input.address), units: match.units ?? input.units,
        source: fill(match.source, input.source), notes: mergedNotes,
        propertyType: match.propertyType === "OTHER" ? input.propertyType : match.propertyType } });
      if (phoneKey(updated.phone)) byPhone.set(phoneKey(updated.phone), updated); byName.set(nk, updated);
      result.merged++; continue;
    }
    const created = await prisma.commercialProspect.create({ data: input });
    if (pk) byPhone.set(pk, created); byName.set(nk, created);
    result.created++;
  }
  return result;
}
