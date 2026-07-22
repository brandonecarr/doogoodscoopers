/**
 * Backfill "number of dogs" onto existing Meta/ad leads.
 *
 * WHY: Facebook collects "How Many Dogs Do You Have?" on the lead form, but the
 * Zapier webhook that creates AdLeads historically only forwarded 7 fields, so
 * the dog answer never reached us. This imports the answer from a source export
 * (Meta Ads Manager / Lead Center CSV) and writes it onto the matching AdLead as
 * customFields.numberOfDogs — the same field the live webhook now populates and
 * that {{dogs}}/{{numberOfDogs}} personalization reads.
 *
 * USAGE:
 *   node --env-file=.env.local --env-file=.env scripts/backfill-ad-lead-dogs.mjs <export.csv>          # dry run
 *   node --env-file=.env.local --env-file=.env scripts/backfill-ad-lead-dogs.mjs <export.csv> --commit  # apply
 *
 * The CSV needs a phone or email column (to match the lead) and a dog-count
 * column. Column names are auto-detected (any header containing "dog", "phone",
 * "email"); order/casing don't matter.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const [csvPath, ...flags] = process.argv.slice(2);
const COMMIT = flags.includes("--commit");
if (!csvPath) {
  console.error("Usage: node scripts/backfill-ad-lead-dogs.mjs <export.csv> [--commit]");
  process.exit(1);
}

// --- tiny CSV parser (handles quoted fields + commas/newlines in quotes) ---
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const last10 = (s) => (String(s || "").replace(/\D/g, "").slice(-10) || null);
const dogCount = (s) => { const m = String(s ?? "").match(/\d+/); return m ? m[0] : (String(s ?? "").trim() || null); };

const rows = parseCsv(readFileSync(csvPath, "utf8"));
if (rows.length < 2) { console.error("CSV has no data rows."); process.exit(1); }
const header = rows[0].map((h) => h.trim().toLowerCase());
const dogCol = header.findIndex((h) => /dog/.test(h));
const phoneCol = header.findIndex((h) => /phone|cell|mobile/.test(h));
const emailCol = header.findIndex((h) => /email/.test(h));
if (dogCol === -1) { console.error(`No dog column found. Headers: ${header.join(", ")}`); process.exit(1); }
if (phoneCol === -1 && emailCol === -1) { console.error(`No phone/email column to match on. Headers: ${header.join(", ")}`); process.exit(1); }
console.log(`Matched columns → dog:"${header[dogCol]}"  phone:"${header[phoneCol] ?? "-"}"  email:"${header[emailCol] ?? "-"}"`);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const leads = await prisma.adLead.findMany({ select: { id: true, phone: true, email: true, fullName: true, firstName: true, customFields: true } });
const byPhone = new Map(), byEmail = new Map();
for (const l of leads) {
  const p = last10(l.phone); if (p) byPhone.set(p, l);
  if (l.email) byEmail.set(l.email.trim().toLowerCase(), l);
}

let matched = 0, updated = 0, skipped = 0, unmatched = 0;
for (const r of rows.slice(1)) {
  const dogs = dogCount(r[dogCol]);
  if (!dogs) { skipped++; continue; }
  const lead = (phoneCol !== -1 && byPhone.get(last10(r[phoneCol]))) || (emailCol !== -1 && byEmail.get(String(r[emailCol] || "").trim().toLowerCase())) || null;
  if (!lead) { unmatched++; console.log(`  no match: ${r[phoneCol] ?? ""} ${r[emailCol] ?? ""}`); continue; }
  matched++;
  const cf = (lead.customFields && typeof lead.customFields === "object") ? { ...lead.customFields } : {};
  if (cf.numberOfDogs != null && String(cf.numberOfDogs) === dogs) continue; // already set
  cf.numberOfDogs = dogs;
  console.log(`  ${COMMIT ? "SET " : "would set"} ${lead.fullName || lead.firstName}: ${dogs} dog(s)`);
  if (COMMIT) { await prisma.adLead.update({ where: { id: lead.id }, data: { customFields: cf } }); updated++; }
}

console.log(`\n${COMMIT ? "APPLIED" : "DRY RUN"} — matched:${matched} updated:${updated} unmatched:${unmatched} blank:${skipped}`);
if (!COMMIT) console.log("Re-run with --commit to write.");
await prisma.$disconnect(); await pool.end();
