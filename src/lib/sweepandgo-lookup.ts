import { recordSngCall } from "@/lib/sweepandgo-usage";
import prisma from "@/lib/prisma";
import { lastCustomerSyncAt } from "@/lib/sweepandgo-customer-sync";

/**
 * "Has this prospect signed up yet?" check, for a quick pre-send guard in the drip /
 * campaign engines (indexes phones for SMS and emails for email campaigns).
 *
 * Reads the local customer mirror (SweepandgoCustomer). Sweep&Go client webhooks trigger
 * a mirror sync within ~30s of a signup (lib/sweepandgo-customer-sync.ts), plus a daily
 * reconciliation, so the mirror is current without calling Sweep&Go on every send. Only
 * if the mirror hasn't synced in 30 hours does this fall back to the live API.
 *
 * Returns null when neither source is available so callers can decide what to do.
 */
const SNG_ACTIVE_CLIENTS_URL = "https://openapi.sweepandgo.com/api/v1/clients/active";
const MAX_PAGES = 20;
const PAGE_LENGTH = 50; // the API's max page size (default 15)
const MIRROR_FRESH_MS = 30 * 60 * 60 * 1000;
const TTL_MS = 60_000;
const PAGE_TIMEOUT_MS = 5_000;

interface SngLite {
  home_phone?: string | null;
  cell_phone?: string | null;
  email?: string | null;
}

interface ActiveIndex {
  phones: Set<string>; // last-10-digit numbers
  emails: Set<string>; // lowercased
}

let cache: { at: number; index: ActiveIndex } | null = null;

/** Last 10 digits of a US number, or null if it isn't a 10-digit number. */
function last10(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = String(raw).replace(/\D/g, "").slice(-10);
  return d.length === 10 ? d : null;
}

function normEmail(raw: string | null | undefined): string {
  return (raw || "").trim().toLowerCase();
}

/** Build the index from the local mirror, if it has synced recently. */
async function mirrorIndex(): Promise<ActiveIndex | null> {
  const last = await lastCustomerSyncAt();
  const synced = last ?? (await prisma.sweepandgoCustomer.aggregate({ where: { active: true }, _max: { lastSyncedAt: true } }))._max.lastSyncedAt;
  if (!synced || Date.now() - synced.getTime() > MIRROR_FRESH_MS) return null;
  const rows = await prisma.sweepandgoCustomer.findMany({ where: { active: true }, select: { homePhone: true, cellPhone: true, email: true } });
  const phones = new Set<string>();
  const emails = new Set<string>();
  for (const r of rows) {
    for (const ph of [r.homePhone, r.cellPhone]) { const t = last10(ph); if (t) phones.add(t); }
    const e = normEmail(r.email);
    if (e) emails.add(e);
  }
  return { phones, emails };
}

/** Pull (and cache) the active-client phone + email index. Null if unreachable. */
async function loadIndex(): Promise<ActiveIndex | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.index;

  try {
    const local = await mirrorIndex();
    if (local) { cache = { at: Date.now(), index: local }; return local; }
  } catch (e) {
    console.error("[sng-lookup] mirror read failed, trying the API:", e instanceof Error ? e.message : e);
  }

  const token = process.env.SWEEPANDGO_API_TOKEN || process.env.SWEEPANDGO_WEBHOOK_SECRET;
  if (!token) return null;

  try {
    const phones = new Set<string>();
    const emails = new Set<string>();
    let page = 1;
    let totalPages = 1;
    do {
      await recordSngCall(SNG_ACTIVE_CLIENTS_URL);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(`${SNG_ACTIVE_CLIENTS_URL}?page=${page}&length=${PAGE_LENGTH}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) return cache?.index ?? null; // reuse a stale cache on failure, else null
      const json = await res.json();
      const data: SngLite[] = json.data ?? [];
      for (const c of data) {
        const h = last10(c.home_phone);
        if (h) phones.add(h);
        const cell = last10(c.cell_phone);
        if (cell) phones.add(cell);
        const e = normEmail(c.email);
        if (e) emails.add(e);
      }
      totalPages = json.paginate?.total_pages ?? page;
      page++;
    } while (page <= totalPages && page <= MAX_PAGES);

    cache = { at: Date.now(), index: { phones, emails } };
    return cache.index;
  } catch {
    return cache?.index ?? null;
  }
}

/** Set of last-10-digit phones for active Sweep&Go clients. Null if unreachable. */
export async function activeClientPhones(): Promise<Set<string> | null> {
  return (await loadIndex())?.phones ?? null;
}

/** Set of lowercased emails for active Sweep&Go clients. Null if unreachable. */
export async function activeClientEmails(): Promise<Set<string> | null> {
  return (await loadIndex())?.emails ?? null;
}

/** True if `phone` belongs to an active Sweep&Go client in the given set. */
export function phoneInActiveSet(phones: Set<string>, phone: string | null | undefined): boolean {
  const t = last10(phone);
  return !!t && phones.has(t);
}

/** True if `email` belongs to an active Sweep&Go client in the given set. */
export function emailInActiveSet(emails: Set<string>, email: string | null | undefined): boolean {
  const e = normEmail(email);
  return !!e && emails.has(e);
}
