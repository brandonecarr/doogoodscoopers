// Business numbers for the office TV: revenue, margin, MRR, reviews, cancellation
// reasons and recent wins. Part of GET /api/tv/snapshot (see tv-snapshot.ts).
import prisma from "@/lib/prisma";
import { getProfitability } from "@/lib/profitability";
import { estimateMonthlyRevenue } from "@/lib/plan-pricing";
import { privateName } from "@/lib/tv-connector";

export interface TvBusiness {
  revenue: { monthLabel: string; thisMonthCents: number; lastMonthLabel: string; lastMonthCents: number };
  margin: { hasExpenses: boolean; marginPct: number | null; profitCents: number; expenseCents: number };
  /** Estimated monthly recurring revenue of active customers (same estimate as Customers → Dashboard). */
  mrrCents: number;
  activeCustomers: number;
  reviews: { average: number | null; total: number | null; thisMonth: number; latest: { name: string; text: string; date: string } | null };
  cancellations: { days: number; total: number; reasons: { label: string; count: number }[] };
  /** Newest first. */
  wins: { kind: "signup" | "review"; title: string; detail: string; date: string }[];
}

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

export async function buildTvBusiness(now = new Date()): Promise<TvBusiness> {
  const cancelDays = 90;
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [profit, active, settings, reviewsThisMonth, latestReview, cancels, signups, fiveStars] = await Promise.all([
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
