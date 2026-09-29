import prisma from "@/lib/prisma";
import { BUSINESS_TZ } from "@/lib/datetime";
import { sendAdminPush } from "@/lib/web-push";

// ── Sweep&Go API usage guard ─────────────────────────────────────────────────
// Every outbound Sweep&Go request is counted per Pacific day per endpoint. In
// Sept 2026 Sweep&Go support flagged ~70k requests/month from us — a free-quotes
// poll running every minute plus a 10-minute invoice sync. Normal volume after
// that fix is roughly 500–600/day; crossing DAILY_ALERT sends one admin push so a
// runaway loop or over-eager cron is caught the same day, not by Sweep&Go.

const DAILY_ALERT = 1500;
const ALERT_MARKER = "__alert__";

function pacificDay(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** "https://openapi.sweepandgo.com/api/v2/invoices?page=2" → "GET /api/v2/invoices" */
function endpointLabel(url: string, method: string): string {
  try {
    return `${method.toUpperCase()} ${new URL(url).pathname}`;
  } catch {
    return `${method.toUpperCase()} ${url.split("?")[0]}`;
  }
}

/** Count one Sweep&Go request. Never throws — metering must not break a sync. */
export async function recordSngCall(url: string, method = "GET"): Promise<void> {
  const day = pacificDay();
  const endpoint = endpointLabel(url, method);
  try {
    await prisma.$executeRaw`
      INSERT INTO "SngApiUsage" ("day", "endpoint", "count") VALUES (${day}::date, ${endpoint}, 1)
      ON CONFLICT ("day", "endpoint") DO UPDATE SET "count" = "SngApiUsage"."count" + 1`;

    const [{ total }] = await prisma.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM("count"), 0)::int AS total FROM "SngApiUsage"
      WHERE "day" = ${day}::date AND "endpoint" <> ${ALERT_MARKER}`;
    if (total < DAILY_ALERT) return;

    // Only the first caller past the threshold inserts the marker, so the push fires once a day.
    const marked = await prisma.$executeRaw`
      INSERT INTO "SngApiUsage" ("day", "endpoint", "count") VALUES (${day}::date, ${ALERT_MARKER}, 0)
      ON CONFLICT DO NOTHING`;
    if (marked === 0) return;

    const top = await prisma.$queryRaw<{ endpoint: string; count: number }[]>`
      SELECT "endpoint", "count" FROM "SngApiUsage"
      WHERE "day" = ${day}::date AND "endpoint" <> ${ALERT_MARKER}
      ORDER BY "count" DESC LIMIT 3`;
    await sendAdminPush({
      title: "⚠️ Sweep&Go API usage spike",
      body: `${total.toLocaleString()} requests today (alert at ${DAILY_ALERT.toLocaleString()}). Top: ${top.map((t) => `${t.endpoint} ${t.count}`).join(" · ")}`,
      url: "/admin",
      tag: `sng-usage-${day}`,
    });
  } catch (e) {
    console.error("[sng-usage] could not record call:", e instanceof Error ? e.message : e);
  }
}

/** Today's (Pacific) request counts per endpoint, busiest first. */
export async function sngUsageToday(): Promise<{ endpoint: string; count: number }[]> {
  const day = pacificDay();
  return prisma.$queryRaw<{ endpoint: string; count: number }[]>`
    SELECT "endpoint", "count" FROM "SngApiUsage"
    WHERE "day" = ${day}::date AND "endpoint" <> ${ALERT_MARKER}
    ORDER BY "count" DESC`;
}
