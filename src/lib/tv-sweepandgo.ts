// Sweep&Go numbers for the office TV, fetched here (once, metered, cached in AppSetting)
// instead of by each TV. The TV asks /api/tv/snapshot every minute; Sweep&Go is only
// called when a cached value is older than its schedule, so an idle office costs nothing.
//
// Sweep&Go allows 100 requests/hour and 500/day for the whole account, shared with the
// admin's own syncs. Budget (one or many TVs): routes every 15 min in business hours /
// hourly after, this week's visits every 30 min / 2 h, the 30-day report and all-time
// totals daily (totals only when a board shows them), commercial count every 6 h.
// About 100/day, at most 6 in any hour.
import prisma from "@/lib/prisma";
import { recordSngCall } from "@/lib/sweepandgo-usage";
import { addDays, businessDay, dayStart, weekStartDay } from "@/lib/tv-connector";
import { catalogItem, defaultConfig, type TvBoardConfig } from "@/lib/tv-config";

const SNG = "https://openapi.sweepandgo.com";
const TIMEOUT_MS = 8_000;
const MIN = 60_000;

/** The fields the TV's route/visit maths need; nothing about the customer. */
export interface TvJob { status_id: number; assigned_to_name: string | null; price: number | null; skip_reason_title: string | null }

export interface TvSweepAndGo {
  fetchedAt: string;
  activeResidential: number;
  activeCommercial: number | null;
  todayJobs: TvJob[] | null;
  weekJobs: TvJob[] | null;
  avgVisitPriceCents30d: number | null;
  totals: { happyFamilies?: number; happyDogs?: number; completedYards?: number };
  /** Net signups per trailing week, oldest first (8 weeks), from SubscriptionEvent. */
  weeklyNetAdds: number[];
  netThisWeek: number;
  warnings: string[];
}

const token = () => process.env.SWEEPANDGO_API_TOKEN || process.env.SWEEPANDGO_WEBHOOK_SECRET || "";
export const sweepAndGoConfigured = () => token().length > 0;

class RateLimited extends Error {}

// When Sweep&Go says stop, every TV poll must not keep knocking: remember when to try again
// (its Retry-After, else 15 minutes) in AppSetting so all server instances honour it.
const PAUSE_KEY = "tv.sng.pausedUntil";
const DEFAULT_PAUSE_MS = 15 * MIN;

async function pausedUntil(): Promise<Date | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: PAUSE_KEY } });
  const until = row ? new Date(row.value) : null;
  return until && until.getTime() > Date.now() ? until : null;
}

async function pause(retryAfterHeader: string | null): Promise<Date> {
  const seconds = Number(retryAfterHeader);
  const until = new Date(Date.now() + (Number.isFinite(seconds) && seconds > 0 ? Math.max(30_000, seconds * 1000) : DEFAULT_PAUSE_MS));
  await prisma.appSetting.upsert({ where: { key: PAUSE_KEY }, create: { key: PAUSE_KEY, value: until.toISOString() }, update: { value: until.toISOString() } });
  return until;
}

const untilText = (d: Date) => d.toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" });

async function get(path: string): Promise<unknown> {
  const paused = await pausedUntil();
  if (paused) throw new RateLimited(`Sweep&Go is limiting requests; trying again at ${untilText(paused)}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await recordSngCall(`${SNG}${path}`);
    const res = await fetch(`${SNG}${path}`, { headers: { Authorization: `Bearer ${token()}`, Accept: "application/json" }, cache: "no-store", signal: controller.signal });
    if (res.status === 429) {
      const until = await pause(res.headers.get("retry-after"));
      throw new RateLimited(`Sweep&Go is limiting requests; trying again at ${untilText(until)}`);
    }
    if (!res.ok) throw new Error(`Sweep&Go HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface Entry<T> { fetchedAt: string; data: T }

/** Reuses `key` until it's `maxAgeMs` old; on failure keeps the last value and reports why. */
async function cached<T>(key: string, maxAgeMs: number, fetchFresh: () => Promise<T>): Promise<{ data: T | null; warning?: string }> {
  const row = await prisma.appSetting.findUnique({ where: { key: `tv.sng.${key}` } });
  let entry: Entry<T> | null = null;
  try { entry = row ? (JSON.parse(row.value) as Entry<T>) : null; } catch { entry = null; }
  if (entry && Date.now() - new Date(entry.fetchedAt).getTime() < maxAgeMs) return { data: entry.data };
  try {
    const data = await fetchFresh();
    const value = JSON.stringify({ fetchedAt: new Date().toISOString(), data } satisfies Entry<T>);
    await prisma.appSetting.upsert({ where: { key: `tv.sng.${key}` }, create: { key: `tv.sng.${key}`, value }, update: { value } });
    return { data };
  } catch (e) {
    const warning = e instanceof RateLimited ? e.message : e instanceof Error ? e.message : "Sweep&Go unreachable";
    return { data: entry?.data ?? null, warning };
  }
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
};

function trim(rows: unknown): TvJob[] {
  return (Array.isArray(rows) ? rows : []).map((r) => {
    const j = r as Record<string, unknown>;
    return { status_id: Number(j.status_id ?? 0), assigned_to_name: (j.assigned_to_name as string) ?? null, price: num(j.price), skip_reason_title: (j.skip_reason_title as string) ?? null };
  });
}

/** Pacific business hours, when routes are actually moving. */
function businessHours(now: Date): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hour12: false }).format(now));
  return hour >= 6 && hour < 19;
}

export async function buildTvSweepAndGo(now = new Date()): Promise<TvSweepAndGo | null> {
  if (!sweepAndGoConfigured()) return null;
  const today = businessDay(now);
  const monday = weekStartDay(today);
  const monthAgo = addDays(today, -30);
  const busy = businessHours(now);
  const warnings: string[] = [];
  const note = (r: { warning?: string }) => { if (r.warning && !warnings.includes(r.warning)) warnings.push(r.warning); };

  // Which totals any board shows (they're all-time numbers; don't fetch what nobody sees).
  const cfgRow = await prisma.tvConfig.findUnique({ where: { id: "default" } });
  const cfg = (cfgRow?.config as unknown as TvBoardConfig | null) ?? defaultConfig(now);
  const used = new Set(cfg.boards.flatMap((b) => b.sections).map((s) => s.elements[0]?.config.metric).filter((m): m is string => !!m && !!catalogItem(m)));

  const [residential, commercial, todayJobs, weekJobs, last30, events] = await Promise.all([
    prisma.sweepandgoCustomer.count({ where: { active: true } }),
    cached<number>("commercial", 6 * 60 * MIN, async () => Number(((await get("/api/v2/commercial_clients/active")) as { paginate?: { total?: number } }).paginate?.total ?? 0)),
    cached<TvJob[]>(`routes:${today}`, (busy ? 15 : 60) * MIN, async () => trim(((await get(`/api/v1/dispatch_board/jobs_for_date?date=${today}`)) as { data?: unknown }).data)),
    cached<TvJob[]>(`week:${monday}:${today}`, (busy ? 30 : 120) * MIN, async () => trim(((await get(`/api/v2/report/completed_jobs_report?date_from=${monday}&date_to=${today}`)) as { job_list?: unknown }).job_list)),
    cached<number | null>(`avg30:${today}`, 24 * 60 * MIN, async () => {
      const jobs = trim(((await get(`/api/v2/report/completed_jobs_report?date_from=${monthAgo}&date_to=${today}`)) as { job_list?: unknown }).job_list);
      const prices = jobs.filter((j) => j.status_id === 2 && (j.price ?? 0) > 0).map((j) => j.price!);
      return prices.length ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) : null;
    }),
    prisma.subscriptionEvent.findMany({
      where: { kind: { in: ["SIGNUP", "CANCELLATION"] }, excluded: false, occurredAt: { gte: dayStart(addDays(today, -56)) } },
      select: { kind: true, occurredAt: true },
    }),
  ]);
  note(commercial); note(todayJobs); note(weekJobs); note(last30);

  const totals: TvSweepAndGo["totals"] = {};
  const wanted: [keyof TvSweepAndGo["totals"], string, string][] = [
    ["happyFamilies", "sng.happy.families", "/api/v2/report/count_happy_clients"],
    ["happyDogs", "sng.happy.dogs", "/api/v2/report/count_happy_dogs"],
    ["completedYards", "sng.completed.yards", "/api/v2/report/jobs_count"],
  ];
  for (const [field, metric, path] of wanted) {
    if (!used.has(metric)) continue;
    const r = await cached<number>(`total:${field}`, 24 * 60 * MIN, async () => Number(((await get(path)) as { data?: unknown }).data ?? 0));
    note(r);
    if (r.data != null) totals[field] = r.data;
  }

  // Trailing 7-day windows ending tomorrow, oldest first; this week = since Monday.
  const tomorrow = dayStart(addDays(today, 1)).getTime();
  const weekMs = 7 * 86_400_000;
  const net = (from: number, to: number) => events.reduce((n, e) => { const t = e.occurredAt.getTime(); return t >= from && t < to ? n + (e.kind === "SIGNUP" ? 1 : -1) : n; }, 0);
  const weeklyNetAdds = Array.from({ length: 8 }, (_, i) => net(tomorrow - (8 - i) * weekMs, tomorrow - (7 - i) * weekMs));

  return {
    fetchedAt: now.toISOString(),
    activeResidential: residential,
    activeCommercial: commercial.data,
    todayJobs: todayJobs.data,
    weekJobs: weekJobs.data,
    avgVisitPriceCents30d: last30.data,
    totals,
    weeklyNetAdds,
    netThisWeek: net(dayStart(monday).getTime(), tomorrow),
    warnings,
  };
}
