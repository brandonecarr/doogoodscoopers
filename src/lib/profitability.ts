import prisma from "@/lib/prisma";
import { TEST_NAME_KEYS } from "@/lib/test-accounts";

/**
 * Profit & loss. Revenue is REAL — money actually collected — on a CASH BASIS:
 * Sweep&Go payments by the date the money moved, from the payments mirror
 * (`SngPayment`). Costs are whatever the owner enters.
 *
 * Why payments and not invoices: invoices are dated by creation, so an October
 * invoice settled by check on Nov 1 counted as October, a September invoice paid
 * Oct 21 never counted as October, and a check for $161 against a $160 invoice
 * showed as $160. Those put October 2026 at $8,008.60 against the $7,788.60
 * Sweep&Go reports.
 *
 * The month is counted EXACTLY the way Sweep&Go's payments report counts it: only
 * payments whose status is still "succeeded". A payment that was later refunded,
 * in full or in part, drops out of the month entirely (owner's call, 2026-11-02 —
 * the CRM must match Sweep&Go to the cent). Failed attempts never count.
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
  /** Collected this month: payments still in status "succeeded", test accounts excluded. Matches Sweep&Go's payments report. */
  revenueCents: number;
  payments: number;
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
  /** False until the payments mirror has rows (first backfill still running). */
  paymentsReady: boolean;
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

  type Rev = { cents: number; payments: number; customers: number };
  const [revenueRows, expenses, paymentCount] = await Promise.all([
    prisma.$queryRaw<{ month: string; cents: bigint; payments: bigint; customers: bigint }[]>`
      select to_char("paidOn", 'YYYY-MM') as month,
             sum("amountCents")::bigint as cents,
             count(*)::bigint as payments,
             count(distinct "nameKey")::bigint as customers
        from "SngPayment"
       where "paidOn" >= ${windowStart}
         and status = 'succeeded'
         and "nameKey" <> all(${TEST_NAME_KEYS})
       group by 1`,
    prisma.expense.findMany(),
    prisma.sngPayment.count(),
  ]);

  const revByMonth = new Map<string, Rev>();
  for (const r of revenueRows) {
    revByMonth.set(r.month, { cents: Number(r.cents ?? 0), payments: Number(r.payments ?? 0), customers: Number(r.customers ?? 0) });
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
      payments: rev?.payments ?? 0,
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
    paymentsReady: paymentCount > 0,
  };
}
