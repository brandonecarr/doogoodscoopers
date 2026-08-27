import prisma from "@/lib/prisma";
import { getSetting } from "@/lib/google-business";

/**
 * Sweep&Go billing mirror — invoices + payments.
 *
 * Why mirror instead of calling live: the Open API pages 10 records at a time,
 * so a full pull is ~300 requests. Far too slow for a profile page load, so a
 * cron syncs it into Postgres and the UI reads locally.
 *
 * ⚠️ CORRECTNESS RULES — these numbers are money on a customer's profile:
 *  1. A page fetch that fails is RETRIED, and if it still fails the whole sync
 *     ABORTS. Silently skipping a page loses real payments and understates
 *     lifetime revenue (it did exactly that: 490 of 1,391 rows on first run).
 *  2. The row count is checked against the API's own reported `total`. A short
 *     pull is treated as a failure, never written.
 *  3. Nothing is written unless BOTH pulls fully succeed (atomic swap).
 *
 * ⚠️ Sweep&Go's billing feeds carry NO client id — a row identifies its customer
 * only by `client_name` — so every row is stored with a normalized `nameKey`.
 */

const SNG_BASE = "https://openapi.sweepandgo.com/api/v2";
// Sweep&Go rate-limits (HTTP 429). Two in flight with a little spacing gets the
// whole dataset without tripping it; a full pull at concurrency 4 did.
const CONCURRENCY = 2;
const BATCH_SPACING_MS = 250;
const PAGE_TIMEOUT_MS = 20_000;
const RETRIES = 5;
const MAX_PAGES = 1_000;
// Ask for large pages. If the API honours it, a full pull drops from ~300
// requests to ~30; if it ignores it, `last_page` still describes reality and the
// loop below is unchanged either way.
const PER_PAGE = 100;

/** Payment statuses that are NOT money we received. Everything else counts. */
const NON_REVENUE_STATUSES = new Set([
  "failed", "pending", "canceled", "cancelled", "voided", "void", "declined", "disputed",
]);

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch one page, retrying transient failures. Throws if it never succeeds. */
async function getPage(path: string): Promise<Record<string, unknown>> {
  const t = token();
  if (!t) throw new Error("SWEEPANDGO_API_TOKEN not set");

  let lastErr = "";
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
    try {
      const res = await fetch(`${SNG_BASE}${path}`, {
        headers: { Authorization: `Bearer ${t}`, Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (res.ok) return (await res.json()) as Record<string, unknown>;
      lastErr = `HTTP ${res.status}`;
      if (res.status === 429) {
        // Rate limited: honour Retry-After when present, else back off hard.
        const ra = Number(res.headers.get("retry-after")) || 0;
        clearTimeout(timer);
        if (attempt < RETRIES) await sleep(ra > 0 ? Math.min(ra * 1000, 30_000) : Math.min(2_000 * 2 ** (attempt - 1), 30_000));
        continue;
      }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "fetch failed";
    } finally {
      clearTimeout(timer);
    }
    if (attempt < RETRIES) await sleep(400 * attempt * attempt);
  }
  throw new Error(`${path} failed after ${RETRIES} attempts: ${lastErr}`);
}

/**
 * Pull EVERY page of a paginated endpoint. Throws if any page can't be fetched
 * or if the collected count falls short of the API's reported total — a partial
 * pull must never be mistaken for the whole dataset.
 */
async function getAllPages(
  buildPath: (page: number) => string,
  envelope: string
): Promise<Record<string, unknown>[]> {
  const first = await getPage(`${buildPath(1)}&per_page=${PER_PAGE}`);
  const env1 = first?.[envelope] as { data?: unknown[]; last_page?: number; total?: number } | undefined;
  if (!env1) throw new Error(`${envelope}: unexpected response shape`);

  const rows: Record<string, unknown>[] = [...((env1.data as Record<string, unknown>[]) || [])];
  const lastPage = Math.min(Number(env1.last_page) || 1, MAX_PAGES);
  const expected = Number(env1.total) || rows.length;

  for (let start = 2; start <= lastPage; start += CONCURRENCY) {
    const batch: Promise<Record<string, unknown>>[] = [];
    for (let p = start; p < start + CONCURRENCY && p <= lastPage; p++) batch.push(getPage(`${buildPath(p)}&per_page=${PER_PAGE}`));
    // Promise.all rejects if ANY page ultimately failed — which aborts the sync.
    const settled = await Promise.all(batch);
    for (const r of settled) {
      const env = r?.[envelope] as { data?: unknown[] } | undefined;
      if (env?.data) rows.push(...(env.data as Record<string, unknown>[]));
    }
    if (start + CONCURRENCY <= lastPage) await sleep(BATCH_SPACING_MS);
  }

  if (rows.length < expected) {
    throw new Error(`${envelope}: incomplete pull — got ${rows.length} of ${expected}`);
  }
  return rows;
}

export interface BillingSyncResult {
  ok: boolean;
  invoices: number;
  payments: number;
  /** Any payment status we did not recognise — worth eyeballing if non-empty. */
  unknownStatuses?: string[];
  error?: string;
}

/**
 * Full refresh of the billing mirror. Everything is fetched and validated FIRST;
 * the swap happens only once both pulls are provably complete.
 */
export async function syncSngBilling(): Promise<BillingSyncResult> {
  if (!token()) return { ok: false, invoices: 0, payments: 0, error: "SWEEPANDGO_API_TOKEN not set" };

  let recurring: Record<string, unknown>[];
  let oneTime: Record<string, unknown>[];
  let payments: Record<string, unknown>[];
  try {
    // Sequential, not parallel: three concurrent full pulls is what tripped the
    // rate limiter in the first place.
    recurring = await getAllPages((p) => `/invoices?type=recurring&page=${p}`, "invoices");
    oneTime = await getAllPages((p) => `/invoices?type=one_time&page=${p}`, "invoices");
    payments = await getAllPages((p) => `/payments?page=${p}`, "payments");
  } catch (e) {
    // Keep the existing mirror rather than replacing it with partial data.
    return { ok: false, invoices: 0, payments: 0, error: e instanceof Error ? e.message : "pull failed" };
  }

  // De-dupe invoices by invoice_number (the unique key) before writing.
  const byNumber = new Map<string, Record<string, unknown>>();
  for (const r of recurring.concat(oneTime)) {
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

  const knownStatuses = new Set(["succeeded", "refunded", "partially_refunded", ...NON_REVENUE_STATUSES]);
  const unknown = new Set<string>();

  const paymentData = payments.map((r) => {
    const status = ((r.status as string) || "").toLowerCase();
    if (status && !knownStatuses.has(status)) unknown.add(status);
    const amount = cents(r.amount);
    const refunded = cents(r.amount_refunded);
    const isRevenue = !NON_REVENUE_STATUSES.has(status);
    return {
      clientName: (r.client_name as string) || null,
      nameKey: nameKey(r.client_name as string),
      paidOn: parseDate(r.date),
      amountCents: amount,
      refundedCents: refunded,
      // What we actually kept. A fully refunded payment nets to zero.
      netCents: isRevenue ? amount - refunded : 0,
      isRevenue,
      tipCents: cents(r.tip_amount),
      status: (r.status as string) || null,
      method: (r.type as string) || null,
      description: (r.description as string) || null,
    };
  });

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

  return {
    ok: true,
    invoices: invoiceData.length,
    payments: paymentData.length,
    ...(unknown.size ? { unknownStatuses: [...unknown] } : {}),
  };
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
  /** False when the last billing sync failed — totals below may be incomplete. */
  syncOk: boolean;
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
    firstInvoiceAt: null, lastPaymentAt: null, invoices: [], ambiguousName: false, noMatch: true, syncOk: true,
  };
  if (!key) return empty;

  const [payAgg, invoices, sameName, lastSync] = await Promise.all([
    // Successful payments only — failed charge attempts are excluded at sync
    // time via isRevenue, and netCents is already net of any refund.
    prisma.sngPayment.aggregate({
      where: { nameKey: key, isRevenue: true },
      _sum: { netCents: true },
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
    // If the last sync failed, the mirror may be stale/partial — say so rather
    // than presenting whatever is left as a confident lifetime figure.
    getSetting("billing.lastSync").catch(() => null),
  ]);
  const syncOk = !lastSync || /ok=true/.test(lastSync);

  const lifetimeCents = payAgg._sum.netCents || 0;

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
    syncOk,
  };
}
