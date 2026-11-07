// Business numbers for the office TV: revenue, margin, MRR, reviews, cancellation
// reasons and recent wins. Part of GET /api/tv/snapshot (see tv-snapshot.ts).
import prisma from "@/lib/prisma";
import { getProfitability } from "@/lib/profitability";
import { estimateMonthlyRevenue } from "@/lib/plan-pricing";
import { privateName } from "@/lib/tv-connector";
import { TEST_NAME_KEYS } from "@/lib/test-accounts";
import { projectedMonthCents } from "@/lib/sweepandgo-subscriptions";

export interface TvBusiness {
  revenue: { monthLabel: string; thisMonthCents: number; lastMonthLabel: string; lastMonthCents: number };
  margin: { hasExpenses: boolean; marginPct: number | null; profitCents: number; expenseCents: number };
  /** Estimated monthly recurring revenue of active customers (same estimate as Customers → Dashboard). */
  mrrCents: number;
  /**
   * What the average customer is invoiced in a month: every invoice (paid or not) in the
   * latest month with a full billing run, summed per customer, averaged across customers.
   */
  avgMonthlyCost: { cents: number; customers: number; monthLabel: string } | null;
  /**
   * Invoices by billing month: how much of this month's (and last month's) invoicing has been
   * paid, and next month projected from every active subscription's monthly amount.
   */
  invoices: {
    thisMonth: TvInvoiceMonth;
    lastMonth: TvInvoiceMonth;
    nextMonth: { monthLabel: string; cents: number; subscriptions: number; asOf: string | null } | null;
  };
  activeCustomers: number;
  reviews: { average: number | null; total: number | null; thisMonth: number; latest: { name: string; text: string; date: string } | null };
  cancellations: { days: number; total: number; reasons: { label: string; count: number }[] };
  /** Newest first. */
  wins: { kind: "signup" | "review"; title: string; detail: string; date: string }[];
}

export interface TvInvoiceMonth { monthLabel: string; invoicedCents: number; paidCents: number; invoices: number; paidInvoices: number }

const MONTH = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
};

/** Blank and catch-all reasons from Sweep&Go all mean "the customer didn't say". */
function reasonLabel(reason: string | null): string {
  const r = (reason || "").trim();
  if (!r || /^(no data|other|none|n\/a)$/i.test(r)) return "Not given";
  return r.replace(/’/g, "'");
}

function nameFrom(full: string | null | undefined, fallback: string): string {
  const parts = (full || "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? privateName(parts[0], parts.length > 1 ? parts[parts.length - 1] : null) : fallback;
}

/**
 * Average invoiced amount per customer for the last COMPLETE month (the current month is
 * still being billed: mid-month signups, paused and overdue customers get invoiced later).
 * Invoices are grouped by their billing period (falling back to creation date).
 *
 * Only RECURRING billing counts (owner, 2026-11-06):
 *  - one-off invoices (initial cleanup, one-time jobs, prorated first periods) are skipped;
 *  - a customer's first billed month is skipped entirely, because Sweep&Go bundles the
 *    initial cleanup and the prorated first period into that first "subscription" invoice;
 *  - promo coupons don't count: Sweep&Go invoices carry only the discounted total, so a
 *    customer whose coupon was active that month is counted at their subscription LIST
 *    price instead (main plan + add-ons, normalized to a month).
 */
async function averageMonthlyCost(now = new Date()): Promise<TvBusiness["avgMonthlyCost"]> {
  const thisMonth = now.toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", timeZone: "America/Los_Angeles" }).slice(0, 7);
  const rows = await prisma.$queryRaw<Array<{ month: string; customers: number; invoices: number; avgCents: number }>>`
    WITH first_month AS (
      SELECT "nameKey", MIN(to_char(COALESCE("periodStart", "sngCreatedAt"), 'YYYY-MM')) AS month
      FROM "SngInvoice" WHERE COALESCE("periodStart", "sngCreatedAt") IS NOT NULL GROUP BY 1
    ), per_customer AS (
      SELECT to_char(COALESCE(i."periodStart", i."sngCreatedAt"), 'YYYY-MM') AS month,
             date_trunc('month', COALESCE(i."periodStart", i."sngCreatedAt")) AS month_start,
             i."nameKey", COUNT(*) AS n, SUM(i."totalCents") AS total
      FROM "SngInvoice" i
      JOIN first_month f ON f."nameKey" = i."nameKey"
      WHERE COALESCE(i."periodStart", i."sngCreatedAt") IS NOT NULL AND i."nameKey" <> ALL(${TEST_NAME_KEYS})
        AND i.type = 'subscription'
        AND to_char(COALESCE(i."periodStart", i."sngCreatedAt"), 'YYYY-MM') > f.month
      GROUP BY 1, 2, 3
    ), priced AS (
      SELECT c.*,
        -- A coupon that was still running during this month.
        EXISTS (SELECT 1 FROM "SngSubscription" s
                 WHERE s."nameKey" = c."nameKey" AND s."couponPercent" > 0
                   AND s."couponEnd" >= c.month_start
                   AND COALESCE(s."startDate", c.month_start) < c.month_start + interval '1 month') AS discounted,
        -- List price of every subscription line active that month, as a monthly amount.
        (SELECT COALESCE(SUM(s."priceCents" * CASE lower(COALESCE(s."billingInterval", 'monthly'))
                   WHEN 'weekly' THEN 52 / 12.0 WHEN 'bi-weekly' THEN 26 / 12.0 WHEN 'bi_weekly' THEN 26 / 12.0
                   WHEN 'quarterly' THEN 1 / 3.0 ELSE 1 END), 0)
           FROM "SngSubscription" s
          WHERE s."nameKey" = c."nameKey"
            AND lower(COALESCE(s."billingInterval", '')) NOT IN ('one_time', 'one-time')
            AND COALESCE(s."startDate", c.month_start) < c.month_start + interval '1 month'
            AND COALESCE(s."canceledAt", s."endDate", '2999-01-01') >= c.month_start) AS list_cents
      FROM per_customer c
    )
    SELECT month, COUNT(*)::int AS customers, SUM(n)::int AS invoices,
           ROUND(AVG(CASE WHEN discounted AND list_cents > 0 THEN list_cents ELSE total END))::int AS "avgCents"
    FROM priced
    GROUP BY month
    HAVING SUM(n) >= 10 AND month < ${thisMonth}
    ORDER BY month DESC
    LIMIT 1`.catch(() => []);
  const r = rows[0];
  if (!r) return null;
  return { cents: Number(r.avgCents), customers: Number(r.customers), monthLabel: MONTH(r.month) };
}

/** Invoiced vs paid for one billing month (by period start, else creation date), tests excluded. */
async function invoiceMonth(monthKey: string): Promise<TvInvoiceMonth> {
  const rows = await prisma.$queryRaw<Array<{ invoiced: number; paid: number; n: number; paidN: number }>>`
    SELECT COALESCE(SUM("totalCents"), 0)::int AS invoiced,
           COALESCE(SUM("paidCents" - "refundedCents"), 0)::int AS paid,
           COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE "remainingCents" <= 0 AND "paidCents" > 0)::int AS "paidN"
    FROM "SngInvoice"
    WHERE to_char(COALESCE("periodStart", "sngCreatedAt"), 'YYYY-MM') = ${monthKey}
      AND "nameKey" <> ALL(${TEST_NAME_KEYS})`.catch(() => []);
  const r = rows[0];
  return { monthLabel: MONTH(monthKey), invoicedCents: Number(r?.invoiced ?? 0), paidCents: Number(r?.paid ?? 0), invoices: Number(r?.n ?? 0), paidInvoices: Number(r?.paidN ?? 0) };
}

async function invoiceNumbers(now: Date): Promise<TvBusiness["invoices"]> {
  const key = (d: Date) => d.toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", timeZone: "America/Los_Angeles" }).slice(0, 7);
  const [y, m] = key(now).split("-").map(Number);
  const thisKey = key(now);
  const lastKey = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
  const nextStart = new Date(Date.UTC(y, m, 1));
  const nextEnd = new Date(Date.UTC(y, m + 1, 1));
  const nextKey = `${nextStart.getUTCFullYear()}-${String(nextStart.getUTCMonth() + 1).padStart(2, "0")}`;
  const [thisMonth, lastMonth, projection] = await Promise.all([
    invoiceMonth(thisKey),
    invoiceMonth(lastKey),
    projectedMonthCents(nextStart, nextEnd).catch(() => null),
  ]);
  return {
    thisMonth,
    lastMonth,
    nextMonth: projection && projection.asOf ? { monthLabel: MONTH(nextKey), cents: projection.cents, subscriptions: projection.subscriptions, asOf: projection.asOf.toISOString() } : null,
  };
}

export async function buildTvBusiness(now = new Date()): Promise<TvBusiness> {
  const cancelDays = 90;
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [profit, active, settings, reviewsThisMonth, latestReview, cancels, signups, fiveStars, avgCost, invoices] = await Promise.all([
    getProfitability(2),
    prisma.sweepandgoCustomer.findMany({ where: { active: true }, select: { subscriptionNames: true } }),
    prisma.appSetting.findMany({ where: { key: { in: ["google.bp.avgRating", "google.bp.reviewCount"] } } }),
    prisma.review.count({ where: { status: "COMPLETED", reviewedAt: { gte: monthStart } } }),
    prisma.review.findFirst({
      where: { status: "COMPLETED", rating: 5, reviewText: { not: null } },
      orderBy: { reviewedAt: "desc" },
      select: { customerName: true, reviewText: true, reviewedAt: true },
    }),
    prisma.subscriptionEvent.findMany({
      where: { kind: "CANCELLATION", excluded: false, occurredAt: { gte: new Date(now.getTime() - cancelDays * 86_400_000) } },
      select: { reason: true },
    }),
    prisma.subscriptionEvent.findMany({
      where: { kind: "SIGNUP", excluded: false, occurredAt: { gte: new Date(now.getTime() - 14 * 86_400_000) } },
      orderBy: { occurredAt: "desc" },
      take: 10,
      select: { clientName: true, city: true, occurredAt: true },
    }),
    prisma.review.findMany({
      where: { status: "COMPLETED", rating: 5, reviewedAt: { gte: new Date(now.getTime() - 14 * 86_400_000) } },
      orderBy: { reviewedAt: "desc" },
      take: 10,
      select: { customerName: true, reviewedAt: true },
    }),
    averageMonthlyCost(now),
    invoiceNumbers(now),
  ]);

  const [last, current] = profit.rows.slice(-2);
  const setting = (key: string) => {
    const v = parseFloat(settings.find((s) => s.key === key)?.value ?? "");
    return Number.isFinite(v) ? v : null;
  };

  const reasonCounts = new Map<string, number>();
  for (const c of cancels) reasonCounts.set(reasonLabel(c.reason), (reasonCounts.get(reasonLabel(c.reason)) ?? 0) + 1);

  const wins: TvBusiness["wins"] = [
    ...signups.map((s) => ({ kind: "signup" as const, title: nameFrom(s.clientName, "New customer"), detail: s.city ? `Signed up · ${s.city}` : "Signed up", date: s.occurredAt.toISOString() })),
    ...fiveStars.filter((r) => r.reviewedAt).map((r) => ({ kind: "review" as const, title: nameFrom(r.customerName, "A customer"), detail: "5-star review", date: r.reviewedAt!.toISOString() })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

  const text = (latestReview?.reviewText || "").replace(/\s+/g, " ").trim();
  return {
    revenue: {
      monthLabel: MONTH(current.month), thisMonthCents: current.revenueCents,
      lastMonthLabel: MONTH(last.month), lastMonthCents: last.revenueCents,
    },
    margin: { hasExpenses: profit.hasExpenses, marginPct: current.marginPct, profitCents: current.profitCents, expenseCents: current.expenseCents },
    mrrCents: Math.round(active.reduce((n, c) => n + estimateMonthlyRevenue(c.subscriptionNames), 0) * 100),
    avgMonthlyCost: avgCost,
    invoices,
    activeCustomers: active.length,
    reviews: {
      average: setting("google.bp.avgRating"),
      total: setting("google.bp.reviewCount"),
      thisMonth: reviewsThisMonth,
      latest: latestReview && text
        ? { name: nameFrom(latestReview.customerName, "A customer"), text: text.length > 180 ? `${text.slice(0, 177).trimEnd()}…` : text, date: latestReview.reviewedAt?.toISOString() ?? "" }
        : null,
    },
    cancellations: {
      days: cancelDays,
      total: cancels.length,
      reasons: [...reasonCounts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    },
    wins,
  };
}
