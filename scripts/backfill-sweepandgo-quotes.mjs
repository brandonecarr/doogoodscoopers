/**
 * One-time backfill of Sweep&Go free-quote leads into the QuoteLead table.
 *
 * Context: Real `free:quote` events were never delivered to the Vercel webhook,
 * so quotes taken on doogoodscoopers.com (Sweep&Go form) never landed in
 * /admin/quote-leads. This pulls the historical free quotes exported from the
 * Sweep&Go API and inserts any that aren't already present (dedup by phone).
 *
 * Sweep&Go free-quote payload shape (GET free_quotes):
 *   first_name, last_name, cell_phone_number, your_email_address,
 *   number_of_dogs, clean_up_frequency, last_time_yard_was_thoroughly_cleaned,
 *   coupon_code, created_at
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-sweepandgo-quotes.mjs [dataFile]           # dry run
 *   node --env-file=.env scripts/backfill-sweepandgo-quotes.mjs [dataFile] --commit  # write
 */

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const DEFAULT_DATA_FILE =
  "/private/tmp/claude-501/-Users-brandonecarr-Downloads-doogoodscoopers/1f72dae7-afaa-4b78-9969-c3a5f9deee87/scratchpad/sweepandgo-free-quotes-2026.json";

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const dataFile = args.find((a) => !a.startsWith("--")) ?? DEFAULT_DATA_FILE;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/** Last 10 digits — the dedup key across differing phone formats. */
function phoneKey(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

async function main() {
  const quotes = JSON.parse(readFileSync(dataFile, "utf8"));
  console.log(`Loaded ${quotes.length} free quotes from ${dataFile}`);
  console.log(commit ? "MODE: COMMIT (will write)\n" : "MODE: DRY RUN (no writes)\n");

  const existing = await prisma.quoteLead.findMany({ select: { phone: true } });
  const existingKeys = new Set(
    existing.map((l) => phoneKey(l.phone)).filter((k) => k !== null)
  );
  console.log(
    `Existing QuoteLead rows: ${existing.length} (${existingKeys.size} with usable phone)\n`
  );

  const seenInBatch = new Set();
  let toInsert = 0;
  let skippedDup = 0;
  let skippedNoPhone = 0;
  let inserted = 0;
  const samples = [];

  for (const q of quotes) {
    const key = phoneKey(q.cell_phone_number);
    if (!key) {
      skippedNoPhone++;
      continue;
    }
    if (existingKeys.has(key) || seenInBatch.has(key)) {
      skippedDup++;
      continue;
    }
    seenInBatch.add(key);
    toInsert++;

    const firstName = (q.first_name || "").trim() || "Unknown";
    const lastName = (q.last_name || "").trim() || null;
    const coupon = q.coupon_code ? `Coupon: ${q.coupon_code}` : null;
    const notes =
      ["Backfilled from Sweep&Go API", coupon].filter(Boolean).join("\n") || null;

    if (samples.length < 8) {
      samples.push(
        `  ${q.created_at.slice(0, 10)}  ${firstName} ${lastName ?? ""}`.trimEnd() +
          `  ${q.cell_phone_number}  dogs=${q.number_of_dogs ?? "?"}  freq=${q.clean_up_frequency ?? "?"}`
      );
    }

    if (commit) {
      await prisma.quoteLead.create({
        data: {
          firstName,
          lastName,
          email: q.your_email_address || null,
          phone: q.cell_phone_number || "",
          zipCode: "", // free-quote payload carries no address
          numberOfDogs: q.number_of_dogs != null ? String(q.number_of_dogs) : null,
          frequency: q.clean_up_frequency || null,
          lastCleaned: q.last_time_yard_was_thoroughly_cleaned || null,
          notes,
          lastStep: "Sweep&Go Quote Form (backfill)",
          createdAt: new Date(q.created_at),
        },
      });
      inserted++;
    }
  }

  console.log("Sample of records that would be inserted:");
  console.log(samples.join("\n"));
  console.log("\n────────── Summary ──────────");
  console.log(`  Would insert : ${toInsert}`);
  console.log(`  Skipped (dup): ${skippedDup}`);
  console.log(`  Skipped (no phone): ${skippedNoPhone}`);
  if (commit) console.log(`  ACTUALLY INSERTED: ${inserted}`);
  else console.log(`\n  Re-run with --commit to write these ${toInsert} rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
