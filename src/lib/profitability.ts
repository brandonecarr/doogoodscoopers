import prisma from "@/lib/prisma";

/**
 * Profit & loss. Revenue is REAL — money actually collected, from the Sweep&Go
 * invoice mirror (paid minus refunded). Costs are whatever the owner enters.
 *
 * Everything is INTEGER CENTS end to end, so a year of arithmetic can't drift.
 */

export const EXPENSE_CATEGORIES: { key: string; label: string }[] = [
  { key: "payroll", label: "Payroll & labor" },
  { key: "fuel", label: "Fuel" },
  { key: "vehicle", label: "Vehicle & maintenance" },
  { key: "insurance", label: "Insurance" },
  { key: "software", label: "Software & subscriptions" },
  { key: "marketing", label: "Marketing & ads" },
  { key: "supplies", label: "Supplies" },
  { key: "disposal", label: "Disposal fees" },
  { key: "phone", label: "Phone & internet" },
  { key: "rent", label: "Rent & storage" },
  { key: "professional", label: "Accounting & legal" },
  { key: "other", label: "Other" },
];

export const categoryLabel = (key: string) =>
  EXPENSE_CATEGORIES.find((c) => c.key === key)?.label ?? key;

export interface MonthRow {
  month: string; // "YYYY-MM"
  revenueCents: number;
  recurringCents: number;
  onetimeCents: number;
  expenseCents: number;
  profitCents: number;
  marginPct: number | null;
  customers: number;
}

export interface CategoryTotal {
  category: string;
  label: string;
  cents: number;
}

export interface Profitability {
  rows: MonthRow[]; // oldest → newest
  byCategory: CategoryTotal[]; // across the window
  monthlyOverheadCents: number; // recurring costs running today
  avgRevenuePerCustomerCents: number;
  /** Customers needed just to cover today's fixed overhead. */
  breakEvenCustomers: number | null;
  hasExpenses: boolean;
}

const ymUTC = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** Inclusive month keys ending with the current month. */
function monthKeys(count: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    out.push(ymUTC(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  return out;
}

const monthStart = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
};
const monthEnd = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1) - 1);
};

export async function getProfitability(months = 12): Promise<Profitability> {
  const keys = monthKeys(months);
  const windowStart = monthStart(keys[0]);

  const [revenueRows, expenses] = await Promise.all([
    prisma.$queryRawUnsafe<{ month: string; cents: bigint; customers: bigint }[]>(
      `select to_char("sngCreatedAt", 'YYYY-MM') as month,
              sum("paidCents" - "refundedCents")::bigint as cents,
              count(distinct "nameKey")::bigint as customers
         from "SngInvoice"
        where "sngCreatedAt" >= $1
        group by 1`,
      windowStart
    ),
    prisma.expense.findMany(),
  ]);

  const revByMonth = new Map<string, { cents: number; customers: number }>();
  for (const r of revenueRows) {
    revByMonth.set(r.month, { cents: Number(r.cents ?? 0), customers: Number(r.customers ?? 0) });
  }

  const catTotals = new Map<string, number>();
  const rows: MonthRow[] = keys.map((key) => {
    const start = monthStart(key);
    const end = monthEnd(key);

    let recurringCents = 0;
    let onetimeCents = 0;
    for (const e of expenses) {
      if (e.kind === "recurring") {
        // Active for any part of this month.
        const from = e.startedOn ?? new Date(0);
        const to = e.endedOn;
        if (from <= end && (!to || to >= start)) {
          recurringCents += e.amountCents;
          catTotals.set(e.category, (catTotals.get(e.category) || 0) + e.amountCents);
        }
      } else if (e.occurredOn && e.occurredOn >= start && e.occurredOn <= end) {
        onetimeCents += e.amountCents;
        catTotals.set(e.category, (catTotals.get(e.category) || 0) + e.amountCents);
      }
    }

    const rev = revByMonth.get(key);
    const revenueCents = rev?.cents ?? 0;
    const expenseCents = recurringCents + onetimeCents;
    const profitCents = revenueCents - expenseCents;

    return {
      month: key,
      revenueCents,
      recurringCents,
      onetimeCents,
      expenseCents,
      profitCents,
      marginPct: revenueCents > 0 ? (profitCents / revenueCents) * 100 : null,
      customers: rev?.customers ?? 0,
    };
  });

  // Overhead running right now (used for break-even, so it must be current
  // rather than an average of historical months).
  const today = new Date();
  const monthlyOverheadCents = expenses
    .filter((e) => e.kind === "recurring" && (!e.endedOn || e.endedOn >= today))
    .reduce((n, e) => n + e.amountCents, 0);

  // Average revenue per customer over the last 3 months with real activity.
  const recent = rows.filter((r) => r.customers > 0).slice(-3);
  const avgRevenuePerCustomerCents = recent.length
    ? Math.round(recent.reduce((n, r) => n + r.revenueCents / r.customers, 0) / recent.length)
    : 0;

  return {
    rows,
    byCategory: [...catTotals.entries()]
      .map(([category, cents]) => ({ category, label: categoryLabel(category), cents }))
      .sort((a, b) => b.cents - a.cents),
    monthlyOverheadCents,
    avgRevenuePerCustomerCents,
    breakEvenCustomers:
      avgRevenuePerCustomerCents > 0 && monthlyOverheadCents > 0
        ? Math.ceil(monthlyOverheadCents / avgRevenuePerCustomerCents)
        : null,
    hasExpenses: expenses.length > 0,
  };
}
