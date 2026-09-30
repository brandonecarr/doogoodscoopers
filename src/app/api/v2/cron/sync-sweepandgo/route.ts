import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendAdminPush } from "@/lib/web-push";
import { syncContactToQuo } from "@/lib/quo";
import { optedOutKeys } from "@/lib/sms-optout";
import { recordSngCall } from "@/lib/sweepandgo-usage";

// Daily safety net for Sweep&Go free quotes.
//
// Quotes arrive ON DEMAND through Sweep&Go's free:quote WEBHOOK
// (api/webhooks/sweepandgo): when someone submits a quote on the website,
// Sweep&Go pushes it to us and the webhook creates the QuoteLead, zip included.
// This cron does NOT poll for new quotes during the day. Once a day it reads the
// free-quotes list and back-fills anything from the last 26 hours the webhook
// missed (outage, dropped delivery), deduped by phone against existing leads.
//
// ⚠️ Schedule is in vercel.json. History: every minute (~45k requests/month,
// flagged by Sweep&Go), then every 5 min, then hourly, now once a day. Sweep&Go's
// account limit is 100 requests/hour and 500/day. Don't speed this back up; if
// leads arrive slowly, fix the webhook instead. Every Sweep&Go call is counted
// (lib/sweepandgo-usage.ts).
//
// Auth to Sweep&Go: Bearer token from the developer portal. We reuse the token
// already stored for the webhook unless a dedicated one is provided.
//   SWEEPANDGO_API_TOKEN  (preferred)  ->  falls back to SWEEPANDGO_WEBHOOK_SECRET
//
// Cron protection: standard CRON_SECRET check (same as the other crons).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SNG_FREE_QUOTES_URL = "https://openapi.sweepandgo.com/api/v2/free_quotes";
// Look back further than the once-a-day run interval so a missed run can't drop a lead.
const LOOKBACK_MINUTES = 26 * 60;

interface FreeQuote {
  first_name: string | null;
  last_name: string | null;
  cell_phone_number: string | null;
  your_email_address: string | null;
  number_of_dogs: number | string | null;
  clean_up_frequency: string | null;
  last_time_yard_was_thoroughly_cleaned: string | null;
  coupon_code: string | null;
  created_at: string;
}

/** Last 10 digits — dedup key across phone formats; rejects junk like 8888888888. */
function phoneKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 10) return null;
  const key = digits.slice(-10);
  if (/^(\d)\1{9}$/.test(key)) return null;
  return key;
}

export async function GET(request: NextRequest) {
  // ── Cron auth ──────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.SWEEPANDGO_API_TOKEN || process.env.SWEEPANDGO_WEBHOOK_SECRET;
  if (!token) {
    return NextResponse.json(
      { error: "Missing SWEEPANDGO_API_TOKEN (or SWEEPANDGO_WEBHOOK_SECRET)" },
      { status: 500 }
    );
  }

  // ── Pull from Sweep&Go ──────────────────────────────────────────────────────
  let quotes: FreeQuote[] = [];
  try {
    await recordSngCall(SNG_FREE_QUOTES_URL);
    const res = await fetch(SNG_FREE_QUOTES_URL, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[SNG sync] API ${res.status}: ${detail.slice(0, 300)}`);
      return NextResponse.json(
        { error: `Sweep&Go API returned ${res.status}`, hint: res.status === 401 ? "Token invalid for API — set SWEEPANDGO_API_TOKEN" : undefined },
        { status: 502 }
      );
    }
    const json = await res.json();
    quotes = json.free_quotes ?? [];
  } catch (err) {
    console.error("[SNG sync] fetch failed:", err);
    return NextResponse.json({ error: "Sweep&Go fetch failed" }, { status: 502 });
  }

  // ── Newest quote per phone within the lookback window ───────────────────────
  const cutoff = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000).toISOString();
  const byPhone = new Map<string, FreeQuote>();
  for (const q of quotes) {
    if (!q.created_at || q.created_at < cutoff) continue;
    const k = phoneKey(q.cell_phone_number);
    if (!k) continue;
    const prev = byPhone.get(k);
    if (!prev || q.created_at > prev.created_at) byPhone.set(k, q);
  }

  // ── Match against existing leads (format-agnostic, any age) ─────────────────
  // A repeat quote from a phone we already have RESURFACES that lead instead of
  // creating a duplicate; a genuinely new phone creates a lead.
  const existing = await prisma.quoteLead.findMany({
    select: { id: true, phone: true, createdAt: true, notes: true, status: true },
  });
  const byKey = new Map<string, { id: string; createdAt: Date; notes: string | null; status: string }>();
  for (const l of existing) {
    const k = phoneKey(l.phone);
    if (!k) continue;
    const prev = byKey.get(k);
    if (!prev || l.createdAt > prev.createdAt) byKey.set(k, { id: l.id, createdAt: l.createdAt, notes: l.notes, status: l.status });
  }
  const optedOut = await optedOutKeys();

  let inserted = 0;
  let bumped = 0;
  const insertedNames: string[] = [];

  for (const [k, q] of byPhone) {
    if (optedOut.has(k)) continue; // opted out (STOP) — never resurface

    const existingLead = byKey.get(k);

    // ── Repeat quote → resurface the existing lead ──────────────────────────
    if (existingLead) {
      // Only act on a quote NEWER than what we've already recorded for this
      // lead. Otherwise the same quote — which lingers in the lookback window
      // for ~30 min — would re-bump/re-notify every minute.
      if (new Date(q.created_at) <= existingLead.createdAt) continue;
      if (existingLead.status === "CONVERTED") continue; // already a customer; leave it
      const note = `Re-quoted ${new Date().toLocaleDateString("en-US")}`;
      const lead = await prisma.quoteLead.update({
        where: { id: existingLead.id },
        data: {
          status: "NEW",
          archived: false,
          createdAt: new Date(), // bump to the top of the list + re-eligible for drips
          lastStep: "Sweep&Go Quote Form",
          notes: [existingLead.notes, note].filter(Boolean).join("\n"),
        },
      });
      syncContactToQuo({
        externalId: `quotelead:${lead.id}`,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        source: "DooGoodScoopers Quote",
      });
      sendAdminPush({
        title: "🔁 Lead re-quoted",
        body: `${lead.firstName}${lead.phone ? ` — ${lead.phone}` : ""}`,
        url: `/admin/quote-leads/${lead.id}`,
        tag: `requote-${lead.id}`,
      }).catch(console.error);
      byKey.set(k, { id: lead.id, createdAt: lead.createdAt, notes: lead.notes, status: "NEW" });
      bumped++;
      continue;
    }

    // ── New phone → create a fresh lead ─────────────────────────────────────
    const lead = await prisma.quoteLead.create({
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
    syncContactToQuo({
      externalId: `quotelead:${lead.id}`,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      source: "DooGoodScoopers Quote",
    });
    sendAdminPush({
      title: "📋 New Quote Lead",
      body: `${lead.firstName}${lead.phone ? ` — ${lead.phone}` : ""}`,
      url: `/admin/quote-leads/${lead.id}`,
      tag: `quote-lead-${lead.id}`,
    }).catch(console.error);
    byKey.set(k, { id: lead.id, createdAt: lead.createdAt, notes: lead.notes, status: "NEW" });
    inserted++;
    insertedNames.push(`${lead.firstName} ${lead.phone}`);
  }

  return NextResponse.json({
    success: true,
    lookbackMinutes: LOOKBACK_MINUTES,
    scannedInWindow: byPhone.size,
    inserted,
    bumped,
    insertedNames,
  });
}
