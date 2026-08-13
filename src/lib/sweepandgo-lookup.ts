/**
 * Live "has this prospect signed up yet?" lookup against Sweep&Go, for a quick
 * pre-send check in the drip / campaign engines.
 *
 * The customer mirror (SweepandgoCustomer) is only refreshed hourly by the
 * sync-customers cron, so a lead who signs up can still get a message in the gap
 * before the next sync. This pulls the LIVE active-client list from Sweep&Go (the
 * same endpoint the sync uses) and caches it for 60s, so a burst of sends in one
 * run shares a single pull and freshness is ~1 minute, not an hour. It indexes
 * both phone numbers (for SMS) and emails (for email campaigns).
 *
 * Returns null when Sweep&Go can't be reached (no token / network / API error /
 * timeout) so callers fall back to the local mirror instead of blocking sends.
 */

const SNG_ACTIVE_CLIENTS_URL = "https://openapi.sweepandgo.com/api/v1/clients/active";
const MAX_PAGES = 20;
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

/** Pull (and cache) the active-client phone + email index. Null if unreachable. */
async function loadIndex(): Promise<ActiveIndex | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.index;

  const token = process.env.SWEEPANDGO_API_TOKEN || process.env.SWEEPANDGO_WEBHOOK_SECRET;
  if (!token) return null;

  try {
    const phones = new Set<string>();
    const emails = new Set<string>();
    let page = 1;
    let totalPages = 1;
    do {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(`${SNG_ACTIVE_CLIENTS_URL}?page=${page}`, {
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
