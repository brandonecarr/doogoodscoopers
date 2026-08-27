import prisma from "@/lib/prisma";
import { getSetting, setSetting } from "@/lib/google-business";

/**
 * Sweep&Go billing mirror — invoices + payments.
 *
 * ⚠️ These numbers are money shown on a customer's profile. Two hard-won rules:
 *
 * 1. RATE LIMITS ARE THE BINDING CONSTRAINT. Sweep&Go returns HTTP 429 well
 *    before a full dataset can be pulled in one invocation — even at ~24
 *    requests with `per_page=100` and backoff. So the sync is RESUMABLE: it
 *    walks the feeds page by page, writes as it goes, and on a rate-limit stop
 *    it saves its position and continues on the next cron tick.
 * 2. WRITES ARE CUMULATIVE (upsert), never wipe-and-replace. A run that stops
 *    early therefore loses nothing — it just leaves the mirror less complete.
 *    An earlier wipe-and-replace design silently stored 490 of 1,391 payments
 *    and understated lifetime revenue by ~4x.
 *
 * The UI only trusts the totals once a FULL pass has completed at least once
 * (`billing.complete`), so a mid-backfill mirror is never presented as fact.
 *
 * ⚠️ Sweep&Go's billing feeds carry NO client id — a row identifies its customer
 * only by `client_name` — so every row stores a normalized `nameKey`.
 */

const SNG_BASE = "https://openapi.sweepandgo.com/api/v2";
const PER_PAGE = 100;          // honoured by the API: 1,391 payments → 14 pages
const SPACING_MS = 2_000;      // deliberate pacing between pages
const PAGE_TIMEOUT_MS = 20_000;
const RETRIES = 2;             // for transient errors only — NEVER for 429s
// Sweep&Go enforces a quota over a window, not just a burst rate. Retrying hard
// through a 429 just deepens the hole (one run burned 5 minutes on backoff and
// was killed at the 300s function limit). So: take a small bite each run, and
// the instant we see a 429, save our place and leave the API alone.
const MAX_PAGES_PER_RUN = 6;
const BUDGET_MS = 120_000;
// Once the history is fully imported, only the newest pages need re-reading.
const REFRESH_PAGES = 2;

class RateLimited extends Error {}

const STATE_KEY = "billing.syncState";
const COMPLETE_KEY = "billing.complete";

/** Payment statuses that are NOT money we received. Everything else counts. */
const NON_REVENUE_STATUSES = new Set([
  "failed", "pending", "canceled", "cancelled", "voided", "void", "declined", "disputed",
]);

interface Feed {
  key: string;
  envelope: string;
  path: (page: number) => string;
}

const FEEDS: Feed[] = [
  { key: "recurring", envelope: "invoices", path: (p) => `/invoices?type=recurring&page=${p}&per_page=${PER_PAGE}` },
  { key: "one_time", envelope: "invoices", path: (p) => `/invoices?type=one_time&page=${p}&per_page=${PER_PAGE}` },
  { key: "payments", envelope: "payments", path: (p) => `/payments?page=${p}&per_page=${PER_PAGE}` },
];

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
    .replace(/[.,\'`]/g, "")
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

/** Fetch one page, retrying transient failures and honouring 429 Retry-After. */
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
      // Rate limited: stop the run immediately. Progress is saved by the caller
      // and the next tick resumes — no point burning the function's clock here.
      if (res.status === 429) throw new RateLimited(`${path}: rate limited`);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "fetch failed";
    } finally {
      clearTimeout(timer);
    }
    if (attempt < RETRIES) await sleep(500 * attempt * attempt);
  }
  throw new Error(`${path}: ${lastErr}`);
}

/** Payment natural key. `isRevenue` disambiguates a failed attempt from the
 *  successful charge for the same invoice/date/amount, while keeping a later
 *  refund of that charge mapped onto the SAME row (status mutates in place). */
function paymentKey(date: unknown, nk: string, amount: number, description: string, isRevenue: boolean): string {
  return [String(date ?? ""), nk, amount, description, isRevenue ? "R" : "F"].join("|");
}

async function writeInvoicePage(rows: Record<string, unknown>[]): Promise<void> {
  for (const r of rows) {
    const invoiceNumber = String(r.invoice_number || "").trim();
    if (!invoiceNumber) continue;
    const data = {
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
      syncedAt: new Date(),
    };
    await prisma.sngInvoice.upsert({
      where: { invoiceNumber },
      create: { invoiceNumber, ...data },
      update: data,
    });
  }
}

async function writePaymentPage(rows: Record<string, unknown>[], unknown: Set<string>): Promise<void> {
  const known = new Set(["succeeded", "refunded", "partially_refunded", ...NON_REVENUE_STATUSES]);
  for (const r of rows) {
    const status = ((r.status as string) || "").toLowerCase();
    if (status && !known.has(status)) unknown.add(status);
    const nk = nameKey(r.client_name as string);
    const amount = cents(r.amount);
    const refunded = cents(r.amount_refunded);
    const isRevenue = !NON_REVENUE_STATUSES.has(status);
    const description = (r.description as string) || "";
    const dedupeKey = paymentKey(r.date, nk, amount, description, isRevenue);
    const data = {
      clientName: (r.client_name as string) || null,
      nameKey: nk,
      paidOn: parseDate(r.date),
      amountCents: amount,
      refundedCents: refunded,
      netCents: isRevenue ? amount - refunded : 0,
      isRevenue,
      tipCents: cents(r.tip_amount),
      status: (r.status as string) || null,
      method: (r.type as string) || null,
      description: description || null,
      syncedAt: new Date(),
    };
    await prisma.sngPayment.upsert({
      where: { dedupeKey },
      create: { dedupeKey, ...data },
      update: data,
    });
  }
}

export interface BillingSyncResult {
  ok: boolean;
  /** True when a full pass finished during this run. */
  complete: boolean;
  rows: number;
  /** Where the next run will resume, when this one stopped early. */
  resumeAt?: string;
  unknownStatuses?: string[];
  error?: string;
}

/**
 * Advance the billing mirror. Resumes from wherever the last run stopped and
 * runs until the data is exhausted, the time budget is spent, or the API rate
 * limit stops us — whichever comes first. Progress is always preserved.
 */
export async function syncSngBilling(): Promise<BillingSyncResult> {
  if (!token()) return { ok: false, complete: false, rows: 0, error: "SWEEPANDGO_API_TOKEN not set" };

  const raw = await getSetting(STATE_KEY).catch(() => null);
  let state: { feed?: string; page?: number } = {};
  try { state = raw ? JSON.parse(raw) : {}; } catch { state = {}; }

  const deadline = Date.now() + BUDGET_MS;
  const unknown = new Set<string>();
  let rows = 0;
  let pagesThisRun = 0;

  // Two modes. Until the history is fully imported we are BACKFILLING and must
  // walk every page. Once complete, a refresh only needs the newest pages.
  const completedAt = await getSetting(COMPLETE_KEY).catch(() => null);
  const refreshing = Boolean(completedAt) && !state.feed;

  const startIndex = Math.max(0, FEEDS.findIndex((f) => f.key === state.feed));
  for (let fi = startIndex; fi < FEEDS.length; fi++) {
    const feed = FEEDS[fi];
    let page = feed.key === state.feed && state.page ? state.page : 1;
    let lastPage = Number.POSITIVE_INFINITY;

    while (page <= lastPage) {
      if (refreshing && page > REFRESH_PAGES) break;
      if (!refreshing && pagesThisRun >= MAX_PAGES_PER_RUN) {
        await setSetting(STATE_KEY, JSON.stringify({ feed: feed.key, page }));
        return { ok: true, complete: false, rows, resumeAt: `${feed.key}:${page}`, ...(unknown.size ? { unknownStatuses: [...unknown] } : {}) };
      }
      if (Date.now() > deadline) {
        await setSetting(STATE_KEY, JSON.stringify({ feed: feed.key, page }));
        return { ok: true, complete: false, rows, resumeAt: `${feed.key}:${page}`, ...(unknown.size ? { unknownStatuses: [...unknown] } : {}) };
      }

      let res: Record<string, unknown>;
      try {
        res = await getPage(feed.path(page));
      } catch (e) {
        // Rate limited / unreachable: keep the ground already covered and stop.
        await setSetting(STATE_KEY, JSON.stringify({ feed: feed.key, page }));
        const limited = e instanceof RateLimited;
        return {
          ok: limited, // being throttled is expected pacing, not a failure
          complete: false, rows, resumeAt: `${feed.key}:${page}`,
          error: limited ? "rate limited — will resume next run" : e instanceof Error ? e.message : "pull failed",
          ...(unknown.size ? { unknownStatuses: [...unknown] } : {}),
        };
      }

      const env = res[feed.envelope] as { data?: unknown[]; last_page?: number } | undefined;
      const data = (env?.data as Record<string, unknown>[]) || [];
      lastPage = Number(env?.last_page) || 1;

      if (feed.envelope === "invoices") await writeInvoicePage(data);
      else await writePaymentPage(data, unknown);
      rows += data.length;
      pagesThisRun++;

      page++;
      if (page <= lastPage) await sleep(SPACING_MS);
    }
  }

  // Every feed walked to its last page — the mirror is whole.
  await setSetting(STATE_KEY, JSON.stringify({}));
  await setSetting(COMPLETE_KEY, new Date().toISOString());
  return { ok: true, complete: true, rows, ...(unknown.size ? { unknownStatuses: [...unknown] } : {}) };
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
    // Totals are only trustworthy once a FULL pass has completed at least once.
    // Mid-backfill the mirror is real but incomplete, and must not be shown as fact.
    getSetting(COMPLETE_KEY).catch(() => null),
  ]);
  const syncOk = Boolean(lastSync);

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
