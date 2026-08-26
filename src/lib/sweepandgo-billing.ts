import prisma from "@/lib/prisma";

/**
 * Sweep&Go billing mirror — invoices + payments.
 *
 * Why mirror instead of calling live: the Open API pages 10 records at a time,
 * so a full pull is ~300 requests (86 pages of recurring invoices, ~? of
 * one-time, 140 of payments). Far too slow for a profile page load, so a cron
 * syncs it into Postgres and the UI reads locally.
 *
 * ⚠️ Sweep&Go's billing feeds carry NO client id — a row identifies its customer
 * only by `client_name`. So every row is stored with a normalized `nameKey` and
 * joined back to SweepandgoCustomer by name. See `nameKey()`.
 */

const SNG_BASE = "https://openapi.sweepandgo.com/api/v2";
const CONCURRENCY = 8;
const PAGE_TIMEOUT_MS = 15_000;
const MAX_PAGES = 400; // hard safety stop

function token(): string | undefined {
  return process.env.SWEEPANDGO_API_TOKEN || process.env.SWEEPANDGO_WEBHOOK_SECRET || undefined;
}

/**
 * Normalized join key for matching a billing row to a customer.
 * Lowercase, punctuation stripped, whitespace collapsed — so "ARMOND  GILBERT"
 * and "Armond Gilbert" land on the same key.
 */
export function nameKey(raw: string | null | undefined): string {
  return (raw || "")
    .toLowerCase()
    .replace(/[.,'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Build a customer's name key from their mirrored first/last name. */
export function customerNameKey(c: { firstName?: string | null; lastName?: string | null }): string {
  return nameKey([c.firstName, c.lastName].filter(Boolean).join(" "));
}

/** Sweep&Go returns money as a string ("73.75") or a number (160). → integer cents. */
function cents(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** "2026-08-23 11:44:45" → Date (null when absent/unparseable). */
function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function getPage(path: string): Promise<Record<string, unknown> | null> {
  const t = token();
  if (!t) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
  try {
    const res = await fetch(`${SNG_BASE}${path}`, {
      headers: { Authorization: `Bearer ${t}`, Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Pull every page of a paginated endpoint. `envelope` is "invoices" | "payments". */
async function getAllPages(
  buildPath: (page: number) => string,
  envelope: string
): Promise<Record<string, unknown>[]> {
  const first = await getPage(buildPath(1));
  const env1 = first?.[envelope] as { data?: unknown[]; last_page?: number } | undefined;
  if (!env1) return [];

  const rows: Record<string, unknown>[] = [...((env1.data as Record<string, unknown>[]) || [])];
  const lastPage = Math.min(Number(env1.last_page) || 1, MAX_PAGES);

  // Remaining pages, fetched in bounded-concurrency chunks.
  for (let start = 2; start <= lastPage; start += CONCURRENCY) {
    const batch: Promise<Record<string, unknown> | null>[] = [];
    for (let p = start; p < start + CONCURRENCY && p <= lastPage; p++) batch.push(getPage(buildPath(p)));
    const settled = await Promise.all(batch);
    for (const r of settled) {
      const env = r?.[envelope] as { data?: unknown[] } | undefined;
      if (env?.data) rows.push(...(env.data as Record<string, unknown>[]));
    }
  }
  return rows;
}

export interface BillingSyncResult {
  ok: boolean;
  invoices: number;
  payments: number;
  error?: string;
}

/**
 * Full refresh of the billing mirror. Everything is fetched into memory FIRST
 * and only swapped in once both pulls look sane — a partial API failure must
 * never wipe good data and show $0 lifetime on every profile.
 */
export async function syncSngBilling(): Promise<BillingSyncResult> {
  if (!token()) return { ok: false, invoices: 0, payments: 0, error: "SWEEPANDGO_API_TOKEN not set" };

  const [recurring, oneTime, payments] = await Promise.all([
    getAllPages((p) => `/invoices?type=recurring&page=${p}`, "invoices"),
    getAllPages((p) => `/invoices?type=one_time&page=${p}`, "invoices"),
    getAllPages((p) => `/payments?page=${p}`, "payments"),
  ]);

  const invoiceRows = [...recurring, ...oneTime];
  if (invoiceRows.length === 0 && payments.length === 0) {
    return { ok: false, invoices: 0, payments: 0, error: "Sweep&Go returned no billing rows — keeping existing mirror" };
  }

  // De-dupe invoices by invoice_number (the unique key) before writing.
  const byNumber = new Map<string, Record<string, unknown>>();
  for (const r of invoiceRows) {
    const num = String(r.invoice_number || "").trim();
    if (num) byNumber.set(num, r);
  }

  const invoiceData = [...byNumber.values()].map((r) => ({
    invoiceNumber: String(r.invoice_number),
    clientName: (r.client_name as string) || null,
    nameKey: nameKey(r.client_name as string),
    status: (r.status as string) || null,
    type: (r.type as string) || null,
    category: (r.category as string) || null,
    billingInterval: (r.billing_interval as string) || null,
    payMethod: (r.pay_method as string) || null,
    totalCents: cents(r.total),
    paidCents: cents(r.paid),
    refundedCents: cents(r.refunded),
    remainingCents: cents(r.remaining),
    tipCents: cents(r.tip_amount),
    periodStart: parseDate(r.period_start),
    periodEnd: parseDate(r.period_end),
    sngCreatedAt: parseDate(r.created_at),
  }));

  const paymentData = payments.map((r) => ({
    clientName: (r.client_name as string) || null,
    nameKey: nameKey(r.client_name as string),
    paidOn: parseDate(r.date),
    amountCents: cents(r.amount),
    refundedCents: cents(r.amount_refunded),
    tipCents: cents(r.tip_amount),
    status: (r.status as string) || null,
    method: (r.type as string) || null,
    description: (r.description as string) || null,
  }));

  // Atomic swap: wipe + rewrite inside one interactive transaction.
  await prisma.$transaction(
    async (tx) => {
      await tx.sngInvoice.deleteMany({});
      await tx.sngPayment.deleteMany({});
      for (const c of chunk(invoiceData, 500)) await tx.sngInvoice.createMany({ data: c, skipDuplicates: true });
      for (const c of chunk(paymentData, 500)) await tx.sngPayment.createMany({ data: c });
    },
    { timeout: 120_000, maxWait: 20_000 }
  );

  return { ok: true, invoices: invoiceData.length, payments: paymentData.length };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Per-customer rollups (read from the mirror — no API calls on page load)
// ---------------------------------------------------------------------------

export interface CustomerInvoice {
  invoiceNumber: string;
  status: string | null;
  type: string | null;
  billingInterval: string | null;
  payMethod: string | null;
  totalCents: number;
  paidCents: number;
  refundedCents: number;
  remainingCents: number;
  periodStart: Date | null;
  periodEnd: Date | null;
  sngCreatedAt: Date | null;
}

export interface CustomerBilling {
  /** Cash actually collected: succeeded payments minus refunds. */
  lifetimeCents: number;
  /** Number of succeeded payments behind that total. */
  paymentCount: number;
  /** Most recent subscription invoice → their current recurring rate. */
  rateCents: number | null;
  rateInterval: string | null;
  /** Date of the earliest invoice we can see (a cross-check on "customer since"). */
  firstInvoiceAt: Date | null;
  lastPaymentAt: Date | null;
  invoices: CustomerInvoice[];
  /** True when more than one customer record shares this name — totals may be shared. */
  ambiguousName: boolean;
  /** No billing rows matched this name at all. */
  noMatch: boolean;
}

/** Human label for a Sweep&Go billing interval. */
export function formatInterval(interval: string | null | undefined): string {
  switch ((interval || "").toLowerCase()) {
    case "monthly": return "per month";
    case "weekly": return "per week";
    case "bi-weekly": return "every 2 weeks";
    case "4_weeks": return "every 4 weeks";
    case "quarterly": return "per quarter";
    case "every_two_months": return "every 2 months";
    case "every_four_months": return "every 4 months";
    case "semi-annually": return "twice a year";
    case "annually": return "per year";
    case "daily": return "per day";
    case "one_time": return "one-time";
    case "initial": return "initial";
    case "prorated": return "prorated";
    default: return interval ? interval.replace(/_/g, " ") : "";
  }
}

/** "$1,234.56" from integer cents. */
export function fmtMoney(c: number): string {
  return (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Everything the profile header + invoice list needs, for one customer. */
export async function getCustomerBilling(customer: {
  firstName?: string | null;
  lastName?: string | null;
}): Promise<CustomerBilling> {
  const key = customerNameKey(customer);
  const empty: CustomerBilling = {
    lifetimeCents: 0, paymentCount: 0, rateCents: null, rateInterval: null,
    firstInvoiceAt: null, lastPaymentAt: null, invoices: [], ambiguousName: false, noMatch: true,
  };
  if (!key) return empty;

  const [payAgg, invoices, sameName] = await Promise.all([
    prisma.sngPayment.aggregate({
      where: { nameKey: key, status: "succeeded" },
      _sum: { amountCents: true, refundedCents: true },
      _count: { _all: true },
      _max: { paidOn: true },
    }),
    prisma.sngInvoice.findMany({
      where: { nameKey: key },
      orderBy: { sngCreatedAt: "desc" },
      take: 200,
    }),
    // >1 customer record sharing this exact name → the totals below are shared.
    prisma.sweepandgoCustomer.count({
      where: {
        firstName: { equals: customer.firstName ?? "", mode: "insensitive" },
        lastName: { equals: customer.lastName ?? "", mode: "insensitive" },
      },
    }),
  ]);

  const lifetimeCents = (payAgg._sum.amountCents || 0) - (payAgg._sum.refundedCents || 0);

  // Current recurring rate = the newest subscription-type invoice.
  const sub = invoices.find((i) => i.type === "subscription") || null;
  const oldest = invoices.length ? invoices[invoices.length - 1] : null;

  return {
    lifetimeCents,
    paymentCount: payAgg._count._all,
    rateCents: sub ? sub.totalCents : null,
    rateInterval: sub ? sub.billingInterval : null,
    firstInvoiceAt: oldest?.sngCreatedAt ?? null,
    lastPaymentAt: payAgg._max.paidOn ?? null,
    invoices: invoices.map((i) => ({
      invoiceNumber: i.invoiceNumber, status: i.status, type: i.type,
      billingInterval: i.billingInterval, payMethod: i.payMethod,
      totalCents: i.totalCents, paidCents: i.paidCents, refundedCents: i.refundedCents,
      remainingCents: i.remainingCents, periodStart: i.periodStart, periodEnd: i.periodEnd,
      sngCreatedAt: i.sngCreatedAt,
    })),
    ambiguousName: sameName > 1,
    noMatch: invoices.length === 0 && payAgg._count._all === 0,
  };
}
