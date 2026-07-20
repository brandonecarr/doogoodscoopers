/**
 * Sync Sweep&Go free-quote leads into QuoteLead from the Sweep&Go API export.
 *
 * The Sweep&Go WEBHOOK is slow (~10 min batches) and sends duplicates. The API
 * reflects a new quote within ~1-2 min. This script upserts by phone so leads
 * appear fast and never duplicate. It also de-dupes existing rows by phone.
 *
 * Usage:
 *   node --env-file=.env scripts/sync-sweepandgo-quotes.mjs <dataFile> [--since=YYYY-MM-DD] [--commit]
 *   (default: dry run; default since = 2026-07-19)
 */

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const sinceArg = (args.find((a) => a.startsWith("--since=")) || "").split("=")[1] || "2026-07-19";
const dataFile = args.find((a) => !a.startsWith("--"));
if (!dataFile) { console.error("Provide a data file path."); process.exit(1); }

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function phoneKey(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 10) return null;
  const key = digits.slice(-10);
  if (/^(\d)\1{9}$/.test(key)) return null; // reject 0000000000, 8888888888, etc.
  return key;
}

async function main() {
  const quotes = JSON.parse(readFileSync(dataFile, "utf8")).free_quotes;
  const since = `${sinceArg}T00:00:00Z`;
  const recent = quotes.filter((q) => q.created_at >= since);
  console.log(`API quotes since ${sinceArg}: ${recent.length}`);
  console.log(commit ? "MODE: COMMIT\n" : "MODE: DRY RUN\n");

  // Latest quote per phone from the API window.
  const byPhone = new Map();
  for (const q of recent) {
    const k = phoneKey(q.cell_phone_number);
    if (!k) continue;
    const prev = byPhone.get(k);
    if (!prev || q.created_at > prev.created_at) byPhone.set(k, q);
  }

  // Existing DB rows grouped by phone.
  const existing = await prisma.quoteLead.findMany({
    select: { id: true, phone: true, firstName: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const dbByPhone = new Map();
  for (const r of existing) {
    const k = phoneKey(r.phone);
    if (!k) continue;
    if (!dbByPhone.has(k)) dbByPhone.set(k, []);
    dbByPhone.get(k).push(r);
  }

  // 1) De-dupe existing rows: keep the oldest per phone, remove the rest.
  let removedDupes = 0;
  for (const [, rows] of dbByPhone) {
    if (rows.length <= 1) continue;
    const [, ...extras] = rows; // rows are asc by createdAt; keep first (oldest)
    for (const e of extras) {
      console.log(`  dedupe: remove ${e.firstName} ${e.phone} (${e.id})`);
      if (commit) await prisma.quoteLead.delete({ where: { id: e.id } });
      removedDupes++;
    }
  }

  // 2) Insert API quotes whose phone isn't already in the DB.
  let inserted = 0;
  for (const [k, q] of byPhone) {
    if (dbByPhone.has(k)) continue; // already have this person
    console.log(`  insert: ${q.first_name || "Unknown"} ${q.cell_phone_number} (${q.created_at.slice(0,16)})`);
    if (commit) {
      await prisma.quoteLead.create({
        data: {
          firstName: (q.first_name || "").trim() || "Unknown",
          lastName: (q.last_name || "").trim() || null,
          email: q.your_email_address || null,
          phone: q.cell_phone_number || "",
          zipCode: "",
          numberOfDogs: q.number_of_dogs != null ? String(q.number_of_dogs) : null,
          frequency: q.clean_up_frequency || null,
          lastCleaned: q.last_time_yard_was_thoroughly_cleaned || null,
          notes: q.coupon_code ? `Coupon: ${q.coupon_code}` : null,
          lastStep: "Sweep&Go Quote Form",
          createdAt: new Date(q.created_at),
        },
      });
    }
    inserted++;
  }

  console.log("\n────────── Summary ──────────");
  console.log(`  Duplicate rows removed: ${removedDupes}`);
  console.log(`  New leads inserted    : ${inserted}`);
  if (commit) console.log(`  Total QuoteLeads now  : ${await prisma.quoteLead.count()}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
