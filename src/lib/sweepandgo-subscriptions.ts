/**
 * Sweep&Go residential subscriptions mirror + the Office TV's invoice numbers.
 *
 * The feed (v2 /subscriptions) is pulled in full by the nightly cancellation-reason
 * sync, which hands the rows here so the mirror costs no extra API requests. Between
 * nightly runs, Sweep&Go's subscription webhooks (created / canceled / paused /
 * unpaused) flag a refresh that the 15-minute billing-events cron performs once the
 * burst has settled (≈8 requests at 50 per page), so the projection follows signups
 * and cancellations the same day instead of the next morning.
 *
 * Projection for next month = every subscription active next month, normalized to a
 * monthly amount (weekly ×52/12, bi-weekly ×26/12, one-time excluded), minus a coupon
 * that is still running then. Test identities never count.
 */

import prisma from "@/lib/prisma";
import { getSetting, setSetting } from "@/lib/google-business";
import { fetchAllSubscriptions, type SngSubscription } from "@/lib/sweepandgo-cancel-reasons";
import { nameKey } from "@/lib/sweepandgo-billing";
import { isTestIdentity, extraTestIdentities, TEST_NAME_KEYS } from "@/lib/test-accounts";

const REFRESH_REQUESTED_KEY = "subscriptions.refreshRequestedAt";
const LAST_RUN_KEY = "subscriptions.lastRunAt";
const REFRESH_SETTLE_MS = 2 * 60 * 1000;
const REFRESH_MIN_GAP_MS = 60 * 60 * 1000;
/** A mirror older than this (or empty) asks the cron for a fill, so the TV never waits for the nightly run. */
const STALE_MS = 36 * 60 * 60 * 1000;

const date = (v: string | null | undefined): Date | null => {
  if (!v) return null;
  const d = new Date(v.includes("T") || v.includes(" ") ? v.replace(" ", "T") + (v.endsWith("Z") ? "" : "Z") : v + "T12:00:00Z");
  return isNaN(d.getTime()) ? null : d;
};
const cents = (v: number | string | null | undefined): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

type FeedRow = SngSubscription & {
  category?: string | null; billing_interval?: string | null; start_date?: string | null; end_date?: string | null;
  current_period_end?: string | null; pricing_plan?: string | null; service_plan?: string | null; frequency?: string | null;
  number_of_dogs?: string | null; zip_code?: string | null; pause_start_date?: string | null; pause_end_date?: string | null;
  coupon_code?: string | null; coupon_percent?: string | number | null; coupon_end?: string | null;
};

/** Replace the mirror with a complete pull. Never called with a partial page set. */
export async function mirrorSubscriptions(rows: SngSubscription[]): Promise<number> {
  const data = (rows as FeedRow[]).map((s) => ({
    clientName: s.client_name ?? null,
    clientEmail: s.client_email ?? null,
    nameKey: nameKey(s.client_name),
    status: (s.status || "unknown").toLowerCase(),
    category: s.category ?? null,
    billingInterval: s.billing_interval ?? null,
    name: s.name ?? null,
    priceCents: cents(s.price),
    pricingPlan: s.pricing_plan ?? null,
    servicePlan: s.service_plan ?? null,
    frequency: s.frequency ?? null,
    numberOfDogs: s.number_of_dogs ?? null,
    zipCode: s.zip_code ?? null,
    startDate: date(s.start_date),
    endDate: date(s.end_date),
    canceledAt: date(s.canceled_at),
    currentPeriodEnd: date(s.current_period_end),
    pauseStart: date(s.pause_start_date),
    pauseEnd: date(s.pause_end_date),
    couponCode: s.coupon_code ?? null,
    couponPercent: s.coupon_percent == null ? null : Number(s.coupon_percent) || null,
    couponEnd: date(s.coupon_end),
  }));
  await prisma.$transaction([prisma.sngSubscription.deleteMany({}), prisma.sngSubscription.createMany({ data })]);
  await setSetting(LAST_RUN_KEY, new Date().toISOString()).catch(() => {});
  return data.length;
}

/** A subscription webhook arrived: refresh soon (debounced by the billing-events cron). */
export async function requestSubscriptionRefresh(at = new Date()): Promise<void> {
  await setSetting(REFRESH_REQUESTED_KEY, at.toISOString()).catch((e) => console.error("[subscriptions] could not flag refresh:", e));
}

/**
 * Flag a refresh only if none is pending: the TV asks every minute, and re-flagging
 * would keep resetting the cron's 2-minute settle so the pull never ran.
 */
async function requestRefreshIfIdle(): Promise<void> {
  const [requested, lastRun] = await Promise.all([getSetting(REFRESH_REQUESTED_KEY).catch(() => null), getSetting(LAST_RUN_KEY).catch(() => null)]);
  const reqAt = requested ? new Date(requested).getTime() : 0;
  const lastAt = lastRun ? new Date(lastRun).getTime() : 0;
  if (reqAt > lastAt) return; // already pending
  await requestSubscriptionRefresh();
}

/** Pull + mirror now if a webhook asked for it, the burst settled, and the last pull is over an hour old. */
export async function syncSubscriptionsIfDue(now = new Date()): Promise<{ ran: boolean; reason: string; count?: number }> {
  const [requested, lastRun] = await Promise.all([getSetting(REFRESH_REQUESTED_KEY).catch(() => null), getSetting(LAST_RUN_KEY).catch(() => null)]);
  if (!requested) return { ran: false, reason: "nothing requested" };
  const reqAt = new Date(requested).getTime();
  const lastAt = lastRun ? new Date(lastRun).getTime() : 0;
  if (reqAt <= lastAt) return { ran: false, reason: "already refreshed since the request" };
  if (now.getTime() - reqAt < REFRESH_SETTLE_MS) return { ran: false, reason: "settling" };
  if (now.getTime() - lastAt < REFRESH_MIN_GAP_MS) return { ran: false, reason: "refreshed within the hour" };
  const subs = await fetchAllSubscriptions();
  const count = await mirrorSubscriptions(subs);
  return { ran: true, reason: "webhook", count };
}

// ── Projection ───────────────────────────────────────────────────────────────

const MONTHS_PER: Record<string, number> = { monthly: 1, weekly: 52 / 12, "bi-weekly": 26 / 12, biweekly: 26 / 12, bi_weekly: 26 / 12, quarterly: 1 / 3, yearly: 1 / 12, annual: 1 / 12 };

/** Sum of every subscription active during [from, to), as a monthly amount. */
export async function projectedMonthCents(from: Date, to: Date): Promise<{ cents: number; subscriptions: number; asOf: Date | null }> {
  const [rows, extra] = await Promise.all([
    prisma.sngSubscription.findMany({ where: { status: { in: ["active", "paused"] } } }),
    extraTestIdentities(),
  ]);
  let total = 0;
  let n = 0;
  for (const s of rows) {
    if (TEST_NAME_KEYS.includes(s.nameKey) || isTestIdentity({ name: s.clientName, email: s.clientEmail }, extra)) continue;
    const interval = (s.billingInterval || "monthly").toLowerCase();
    if (interval === "one_time" || interval === "one-time") continue;
    if (s.canceledAt && s.canceledAt < to) continue;
    if (s.endDate && s.endDate < from) continue;
    // Paused across the whole month → nothing billed.
    if (s.pauseStart && s.pauseStart <= from && (!s.pauseEnd || s.pauseEnd >= to)) continue;
    if (s.status === "paused" && !s.pauseEnd) continue;
    let amount = s.priceCents * (MONTHS_PER[interval] ?? 1);
    if (s.couponPercent && s.couponEnd && s.couponEnd >= from) amount *= 1 - s.couponPercent / 100;
    total += amount;
    n++;
  }
  const latest = rows.length ? rows.reduce((d, s) => (s.syncedAt > d ? s.syncedAt : d), rows[0].syncedAt) : null;
  // Empty or stale mirror → ask the 15-minute cron to pull it (idempotent while pending).
  if (!latest || Date.now() - latest.getTime() > STALE_MS) await requestRefreshIfIdle().catch(() => {});
  return { cents: Math.round(total), subscriptions: n, asOf: latest };
}
