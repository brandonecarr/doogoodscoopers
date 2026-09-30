// Sweep&Go numbers for the office TV, fetched here (once, metered, cached in AppSetting)
// instead of by each TV. The TV asks /api/tv/snapshot every minute; Sweep&Go is only
// called when a cached value is older than its schedule, so an idle office costs nothing.
//
// Sweep&Go allows 100 requests/hour and 500/day for the whole account, shared with the
// admin's own syncs. Budget (one or many TVs): routes every 15 min in business hours /
// hourly after, this week's visits every 30 min / 2 h, the 30-day report and all-time
// totals daily (totals only when a board shows them), commercial count every 6 h.
// About 100/day, at most 6 in any hour.
//
// Live stops: Sweep&Go's job webhooks (job:completed, skipped/started notifications)
// arrive about a second after a tech taps the button, and applyJobWebhook() flips that
// stop on the cached route instantly, with no API call. While those webhooks are
// flowing, the route and week lists are only re-fetched every few hours as a check;
// if they stop arriving, polling falls back to the schedule above on its own.
import prisma from "@/lib/prisma";
import { recordSngCall } from "@/lib/sweepandgo-usage";
import { addDays, businessDay, dayStart, weekStartDay } from "@/lib/tv-connector";
import { catalogItem, defaultConfig, type TvBoardConfig } from "@/lib/tv-config";

const SNG = "https://openapi.sweepandgo.com";
const TIMEOUT_MS = 8_000;
const MIN = 60_000;

/** The fields the TV's route/visit maths need; nothing about the customer. */
export interface TvJob { status_id: number; assigned_to_name: string | null; price: number | null; skip_reason_title: string | null }
/** Cached server-side with the Sweep&Go job id so webhooks can find the stop; never sent to the TV. */
interface CachedJob extends TvJob { job_id: number | null }
const publicJobs = (rows: CachedJob[] | null): TvJob[] | null =>
  rows ? rows.map(({ status_id, assigned_to_name, price, skip_reason_title }) => ({ status_id, assigned_to_name, price, skip_reason_title })) : null;

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

function trim(rows: unknown): CachedJob[] {
  return (Array.isArray(rows) ? rows : []).map((r) => {
    const j = r as Record<string, unknown>;
    const id = Number(j.id ?? j.job_id ?? 0);
    return {
      status_id: Number(j.status_id ?? 0), assigned_to_name: (j.assigned_to_name as string) ?? null, price: num(j.price),
      skip_reason_title: (j.skip_reason_title as string) ?? null, job_id: id > 0 ? id : null,
    };
  });
}

/** Pacific business hours, when routes are actually moving. */
function businessHours(now: Date): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hour12: false }).format(now));
  return hour >= 6 && hour < 19;
}

// ── Live stops from Sweep&Go job webhooks ────────────────────────────────────────
const WEBHOOK_SEEN_KEY = "tv.sng.jobWebhookAt";
// Stops can be 45+ minutes apart, so "flowing" means a job webhook within 2 hours.
const WEBHOOK_LIVE_MS = 120 * MIN;

async function jobWebhooksLive(now: Date): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: WEBHOOK_SEEN_KEY } });
  const at = row ? Date.parse(row.value) : NaN;
  return Number.isFinite(at) && now.getTime() - at < WEBHOOK_LIVE_MS;
}

const COMPLETED = new Set(["job:completed", "notification:completed_job_notification", "commercial_notification:completed_job_notification"]);
const SKIPPED = new Set(["notification:skipped_job_notification", "commercial_notification:skipped_job_notification"]);
const STARTED = new Set(["job:started", "commercial_job:started"]);
const JOB_EVENT = /^(job:|commercial_job:|notification:|commercial_notification:)/;

/** Read-modify-write one cached TV entry under a row lock, so concurrent deliveries can't clobber each other. */
async function updateEntry(key: string, fn: (e: Entry<CachedJob[]>) => boolean): Promise<"updated" | "unchanged" | "missing"> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "key" FROM "AppSetting" WHERE "key" = ${key} FOR UPDATE`;
    const row = await tx.appSetting.findUnique({ where: { key } });
    if (!row) return "missing";
    let entry: Entry<CachedJob[]>;
    try { entry = JSON.parse(row.value) as Entry<CachedJob[]>; } catch { return "missing"; }
    if (!Array.isArray(entry.data)) return "missing";
    if (!fn(entry)) return "unchanged";
    await tx.appSetting.update({ where: { key }, data: { value: JSON.stringify(entry) } });
    return "updated";
  });
}

/**
 * Apply a Sweep&Go job webhook to the TV's cached route (and this week's visits) without
 * calling the API. `sentAt` is Sweep&Go's own event time. Never throws.
 */
export async function applyJobWebhook(event: string, data: Record<string, unknown>, sentAt: Date | null, now = new Date()): Promise<void> {
  if (!JOB_EVENT.test(event)) return;
  try {
    await prisma.appSetting.upsert({
      where: { key: WEBHOOK_SEEN_KEY },
      create: { key: WEBHOOK_SEEN_KEY, value: now.toISOString() },
      update: { value: now.toISOString() },
    });
    const status = COMPLETED.has(event) ? 2 : SKIPPED.has(event) ? 3 : STARTED.has(event) ? 5 : null;
    const jobId = Number(data.job_id ?? data.id ?? 0);
    if (status == null || !(jobId > 0)) return; // e.g. on-the-way: proof of life only

    // The job's own date, so a late event can't touch another day's route. job:started sends
    // `date`; job:completed only has "YYYY-MM-DD HH:MM:SS" start/end times.
    const jobDate = [data.date, data.end_time, data.start_time]
      .map((v) => (typeof v === "string" ? v.slice(0, 10) : ""))
      .find((v) => /^\d{4}-\d{2}-\d{2}$/.test(v));
    const today = jobDate ?? businessDay(now);
    const skipReason = (data.skip_reason_title ?? data.skip_reason ?? data.reason ?? null) as string | null;
    let stop: CachedJob | null = null;
    const routes = await updateEntry(`tv.sng.routes:${today}`, (e) => {
      const j = e.data.find((x) => x.job_id === jobId);
      if (!j) {
        // A stop added after the last fetch: expire the cache so the next TV poll re-reads it,
        // at most once per 10 minutes so stray events can't turn into a stream of API calls.
        if (now.getTime() - Date.parse(e.fetchedAt) < 10 * MIN) return false;
        e.fetchedAt = new Date(0).toISOString();
        return true;
      }
      stop = j;
      if (j.status_id === 2 || j.status_id === 3) return false; // finished stays finished
      if (status === 5 && j.status_id === 5) return false;
      j.status_id = status;
      if (status === 3 && skipReason) j.skip_reason_title = skipReason;
      return true;
    });

    // Count a completion in this week's visits if it's a stop on today's route and happened
    // after that list was fetched. Unmatched events wait for the next fetch instead.
    const found = stop as CachedJob | null;
    if (status === 2 && routes !== "missing" && found) {
      await updateEntry(`tv.sng.week:${weekStartDay(today)}:${today}`, (e) => {
        if (e.data.some((x) => x.job_id === jobId)) return false;
        if (sentAt && sentAt.getTime() <= Date.parse(e.fetchedAt)) return false; // already in the report
        e.data.push({
          status_id: 2, assigned_to_name: found.assigned_to_name ?? ((data.tech_name as string) || null),
          price: found.price ?? num(data.price), skip_reason_title: null, job_id: jobId,
        });
        return true;
      });
    }
  } catch (e) {
    console.error("[tv] could not apply Sweep&Go job webhook:", e instanceof Error ? e.message : e);
  }
}

export async function buildTvSweepAndGo(now = new Date()): Promise<TvSweepAndGo | null> {
  if (!sweepAndGoConfigured()) return null;
  const today = businessDay(now);
  const monday = weekStartDay(today);
  const monthAgo = addDays(today, -30);
  const busy = businessHours(now);
  // With job webhooks flowing, the lists stay current on their own; re-fetch only as a check.
  const live = await jobWebhooksLive(now);
  const warnings: string[] = [];
  const note = (r: { warning?: string }) => { if (r.warning && !warnings.includes(r.warning)) warnings.push(r.warning); };

  // Which totals any board shows (they're all-time numbers; don't fetch what nobody sees).
  const cfgRow = await prisma.tvConfig.findUnique({ where: { id: "default" } });
  const cfg = (cfgRow?.config as unknown as TvBoardConfig | null) ?? defaultConfig(now);
  const used = new Set(cfg.boards.flatMap((b) => b.sections).map((s) => s.elements[0]?.config.metric).filter((m): m is string => !!m && !!catalogItem(m)));

  const [residential, commercial, todayJobs, weekJobs, last30, events] = await Promise.all([
    prisma.sweepandgoCustomer.count({ where: { active: true } }),
    cached<number>("commercial", 6 * 60 * MIN, async () => Number(((await get("/api/v2/commercial_clients/active")) as { paginate?: { total?: number } }).paginate?.total ?? 0)),
    cached<CachedJob[]>(`routes:${today}`, (busy ? (live ? 120 : 15) : 60) * MIN, async () => trim(((await get(`/api/v1/dispatch_board/jobs_for_date?date=${today}`)) as { data?: unknown }).data)),
    cached<CachedJob[]>(`week:${monday}:${today}`, (busy ? (live ? 240 : 30) : 120) * MIN, async () => trim(((await get(`/api/v2/report/completed_jobs_report?date_from=${monday}&date_to=${today}`)) as { job_list?: unknown }).job_list)),
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
    todayJobs: publicJobs(todayJobs.data),
    weekJobs: publicJobs(weekJobs.data),
    avgVisitPriceCents30d: last30.data,
    totals,
    weeklyNetAdds,
    netThisWeek: net(dayStart(monday).getTime(), tomorrow),
    warnings,
  };
}
