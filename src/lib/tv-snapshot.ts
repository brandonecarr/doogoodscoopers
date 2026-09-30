// Builds the payload for GET /api/tv/snapshot: everything the Apple TV board shows
// from the admin (leads, follow-ups, tasks, calendar, active-customer history).
// Lead statuses are returned raw; the TV maps them onto the pipeline stages the
// user defined. Names are shortened (first name + initial) before they leave here.

import prisma from "@/lib/prisma";
import { addDays, businessDay, dayStart, privateName, shortDayLabel, weekStartDay } from "@/lib/tv-connector";
import { buildTvBusiness, type TvBusiness } from "@/lib/tv-business";
import { buildTvSweepAndGo, type TvSweepAndGo } from "@/lib/tv-sweepandgo";

export interface TvCard { title: string; meta: string; commercial: boolean }
export interface TvTask { id: string; title: string; meta: string; overdue: boolean; commercial: boolean }

export interface TvSnapshot {
  generatedAt: string;
  today: string;
  weekStart: string;
  leads: {
    /** Leads created in the last 30 days (not archived), by current status. */
    byStatus: Record<string, number>;
    /** Newest few of those, per status. */
    cards: Record<string, TvCard[]>;
    /** Leads created this week, by current status (the funnel). */
    weekByStatus: Record<string, number>;
    weekCreated: number;
    /** Leads marked converted this week (by last update). */
    wonThisWeek: number;
    /** Leads created per week, oldest first; the last entry is this week so far. */
    weekly: number[];
    last30: { created: number; converted: number };
    sources30: { label: string; count: number }[];
  };
  followUpsToday: { title: string; detail: string }[];
  tasks: { todo: TvTask[]; doing: TvTask[]; done: TvTask[]; counts: { todo: number; doing: number; doneThisWeek: number } };
  upcoming: { day: string; label: string; title: string }[];
  activeHistory: { date: string; value: number }[];
  /** Revenue, margin, MRR, reviews, cancellation reasons and recent wins. */
  business: TvBusiness;
  /** Sweep&Go numbers fetched by the admin (null when no Sweep&Go token is configured). */
  sweepAndGo: TvSweepAndGo | null;
  /** Custom Kanban boards; each column has its full count and the first few cards. */
  kanbanBoards: { id: string; name: string; columns: { id: string; name: string; isDone: boolean; count: number; cards: TvTask[] }[] }[];
}

type Lead = { createdAt: Date; updatedAt: Date; status: string; archived: boolean; title: string; meta: string; source: string; commercial: boolean };

const STATUS_LABEL: Record<string, string> = {
  NEW: "New lead", CONTACTED: "Contacted", NO_ANSWER: "No answer", NOT_INTERESTED: "Not interested",
  WAITING_FOR_SIGNUP: "Waiting to sign up", CONVERTED: "Converted", PHONE_REVIEW: "Phone review",
  TO_CALL: "To call", ATTEMPTED: "Attempted",
};

function dogs(n: string | null | undefined): string {
  const count = parseInt(n || "", 10);
  return Number.isFinite(count) && count > 0 ? `Res · ${count} dog${count === 1 ? "" : "s"}` : "Residential";
}

/** Every lead created since `since`, from all lead tables, in one shape. */
async function leadsSince(since: Date): Promise<Lead[]> {
  const where = { createdAt: { gte: since } };
  const base = { createdAt: true, updatedAt: true, status: true, archived: true } as const;
  const [quotes, ads, instas, canvs, commercials] = await Promise.all([
    prisma.quoteLead.findMany({ where, select: { ...base, firstName: true, lastName: true, numberOfDogs: true, sourceChannel: true } }),
    prisma.adLead.findMany({ where, select: { ...base, firstName: true, lastName: true, fullName: true } }),
    prisma.instagramLead.findMany({ where, select: { ...base, firstName: true, lastName: true, username: true } }),
    prisma.canvasserLead.findMany({ where, select: { ...base, firstName: true, lastName: true } }),
    prisma.commercialLead.findMany({ where, select: { ...base, propertyName: true, contactName: true } }),
  ]);
  const out: Lead[] = [];
  for (const l of quotes) out.push({ ...l, title: privateName(l.firstName, l.lastName), meta: dogs(l.numberOfDogs), source: l.sourceChannel === "instagram" ? "Instagram" : "Website", commercial: false });
  for (const l of ads) {
    const [first, ...rest] = (l.fullName || "").trim().split(/\s+/);
    out.push({ ...l, title: privateName(l.firstName || first, l.lastName || rest.pop()), meta: "Meta ad", source: "Meta ads", commercial: false });
  }
  for (const l of instas) out.push({ ...l, title: l.firstName ? privateName(l.firstName, l.lastName) : "Instagram lead", meta: "Instagram", source: "Instagram", commercial: false });
  for (const l of canvs) out.push({ ...l, title: privateName(l.firstName, l.lastName), meta: "Door-to-door", source: "Door-to-door", commercial: false });
  for (const l of commercials) out.push({ ...l, title: l.propertyName || l.contactName || "Commercial lead", meta: "Commercial", source: "Commercial", commercial: true });
  return out;
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) out[key(item)] = (out[key(item)] || 0) + 1;
  return out;
}

export async function buildTvSnapshot(now = new Date()): Promise<TvSnapshot> {
  const today = businessDay(now);
  const weekStart = weekStartDay(today);
  const weekStartAt = dayStart(weekStart);
  const todayStart = dayStart(today);
  const tomorrowStart = dayStart(addDays(today, 1));
  const thirtyAgo = dayStart(addDays(today, -30));
  const eightWeeksAgo = dayStart(addDays(weekStart, -7 * 7));

  const [leads, tasks, calendar, history, followUps, kanban, business, sweepAndGo] = await Promise.all([
    leadsSince(eightWeeksAgo < thirtyAgo ? eightWeeksAgo : thirtyAgo),
    prisma.task.findMany({
      where: { OR: [{ status: { in: ["TODO", "DOING"] } }, { status: "DONE", doneAt: { gte: weekStartAt } }] },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.calendarEntry.findMany({ where: { startAt: { gte: todayStart, lt: dayStart(addDays(today, 30)) } }, orderBy: { startAt: "asc" }, take: 10 }),
    prisma.tvMetricDaily.findMany({ where: { metric: "active_customers" }, orderBy: { date: "asc" }, take: 400 }),
    followUpsToday(todayStart, tomorrowStart),
    prisma.kanbanBoard.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        columns: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        cards: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      },
    }),
    buildTvBusiness(now),
    buildTvSweepAndGo(now),
  ]);

  // Pipeline: last 30 days. Converted leads usually get archived, so keep those for the Won stage.
  const recent = leads.filter((l) => l.createdAt >= thirtyAgo && (!l.archived || l.status === "CONVERTED"));
  const cards: Record<string, TvCard[]> = {};
  for (const l of [...recent].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    const list = (cards[l.status] ||= []);
    if (list.length < 8) list.push({ title: l.title, meta: l.meta, commercial: l.commercial }); // 8 fill a full-screen section
  }

  // Funnel: this week's leads by current status, and conversions this week.
  const thisWeek = leads.filter((l) => l.createdAt >= weekStartAt);
  const wonThisWeek = leads.filter((l) => l.status === "CONVERTED" && l.updatedAt >= weekStartAt).length;

  // Weekly counts, oldest first (8 weeks including this one).
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const from = dayStart(addDays(weekStart, -7 * (7 - i)));
    const to = dayStart(addDays(weekStart, -7 * (7 - i) + 7));
    return leads.filter((l) => l.createdAt >= from && l.createdAt < to).length;
  });

  const last30All = leads.filter((l) => l.createdAt >= thirtyAgo);
  const sources = Object.entries(countBy(last30All, (l) => l.source))
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // Tasks.
  const toTask = (t: (typeof tasks)[number]): TvTask => {
    const overdue = t.status !== "DONE" && !!t.dueOn && t.dueOn < todayStart;
    const parts = [t.tag, t.owner].filter(Boolean) as string[];
    if (t.status !== "DONE" && t.dueOn) {
      const due = businessDay(t.dueOn);
      parts.push(overdue ? "overdue" : due === today ? "today" : due <= addDays(today, 6) ? shortDayLabel(due).split(" ")[0] : shortDayLabel(due));
    }
    return { id: t.id, title: t.title, meta: parts.join(" · "), overdue, commercial: (t.tag || "").toLowerCase() === "commercial" };
  };
  const todo = tasks.filter((t) => t.status === "TODO");
  const doing = tasks.filter((t) => t.status === "DOING");
  const done = tasks.filter((t) => t.status === "DONE").sort((a, b) => (b.doneAt?.getTime() || 0) - (a.doneAt?.getTime() || 0));

  // Coming up: calendar entries plus open tasks with a due date, soonest first.
  const upcoming = [
    ...calendar.map((e) => ({ day: businessDay(e.startAt), title: e.title })),
    ...[...todo, ...doing].filter((t) => t.dueOn && t.dueOn >= todayStart).map((t) => ({ day: businessDay(t.dueOn!), title: t.title })),
  ]
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(0, 10)
    .map((u) => ({ ...u, label: u.day === today ? "Today" : shortDayLabel(u.day) }));

  return {
    generatedAt: now.toISOString(),
    today,
    weekStart,
    leads: {
      byStatus: countBy(recent, (l) => l.status),
      cards,
      weekByStatus: countBy(thisWeek, (l) => l.status),
      weekCreated: thisWeek.length,
      wonThisWeek,
      weekly,
      last30: { created: last30All.length, converted: last30All.filter((l) => l.status === "CONVERTED").length },
      sources30: sources,
    },
    followUpsToday: followUps,
    tasks: {
      todo: todo.slice(0, 6).map(toTask),
      doing: doing.slice(0, 6).map(toTask),
      done: done.slice(0, 6).map(toTask),
      counts: { todo: todo.length, doing: doing.length, doneThisWeek: done.length },
    },
    upcoming,
    activeHistory: history.map((h) => ({ date: h.date, value: h.value })),
    business,
    sweepAndGo,
    kanbanBoards: kanban.map((b) => ({
      id: b.id,
      name: b.name,
      columns: b.columns.map((col) => {
        const cards = b.cards.filter((c) => c.columnId === col.id);
        return {
          id: col.id, name: col.name, isDone: col.isDone, count: cards.length,
          cards: cards.slice(0, 8).map((c) => {
            const overdue = !col.isDone && !!c.dueOn && c.dueOn < todayStart;
            const parts = [c.tag, c.owner].filter(Boolean) as string[];
            if (!col.isDone && c.dueOn) {
              const due = businessDay(c.dueOn);
              parts.push(overdue ? "overdue" : due === today ? "today" : due <= addDays(today, 6) ? shortDayLabel(due).split(" ")[0] : shortDayLabel(due));
            }
            return { id: c.id, title: c.title, meta: parts.join(" · "), overdue, commercial: (c.tag || "").toLowerCase() === "commercial" };
          }),
        };
      }),
    })),
  };
}

/** Leads and call-list prospects due for a follow-up today. */
async function followUpsToday(from: Date, to: Date): Promise<{ title: string; detail: string }[]> {
  const where = { archived: false, followupDate: { gte: from, lt: to } };
  const [quotes, ads, instas, canvs, commercials, prospects] = await Promise.all([
    prisma.quoteLead.findMany({ where, select: { firstName: true, lastName: true, status: true, followupDate: true } }),
    prisma.adLead.findMany({ where, select: { firstName: true, lastName: true, fullName: true, status: true, followupDate: true } }),
    prisma.instagramLead.findMany({ where, select: { firstName: true, lastName: true, status: true, followupDate: true } }),
    prisma.canvasserLead.findMany({ where, select: { firstName: true, lastName: true, status: true, followupDate: true } }),
    prisma.commercialLead.findMany({ where, select: { propertyName: true, status: true, followupDate: true } }),
    prisma.commercialProspect.findMany({
      where: { status: { not: "ARCHIVED" }, followupDate: { gte: from, lt: to } },
      select: { propertyName: true, propertyType: true, status: true, followupDate: true },
    }),
  ]);
  const rows: { at: number; title: string; detail: string }[] = [];
  const label = (s: string) => STATUS_LABEL[s] || s;
  for (const l of quotes) rows.push({ at: l.followupDate!.getTime(), title: privateName(l.firstName, l.lastName), detail: `${label(l.status)} · Quote` });
  for (const l of ads) {
    const [first, ...rest] = (l.fullName || "").trim().split(/\s+/);
    rows.push({ at: l.followupDate!.getTime(), title: privateName(l.firstName || first, l.lastName || rest.pop()), detail: `${label(l.status)} · Meta ad` });
  }
  for (const l of instas) rows.push({ at: l.followupDate!.getTime(), title: privateName(l.firstName, l.lastName, "Instagram lead"), detail: `${label(l.status)} · Instagram` });
  for (const l of canvs) rows.push({ at: l.followupDate!.getTime(), title: privateName(l.firstName, l.lastName), detail: `${label(l.status)} · Door-to-door` });
  for (const l of commercials) rows.push({ at: l.followupDate!.getTime(), title: l.propertyName, detail: `${label(l.status)} · Commercial` });
  for (const p of prospects) rows.push({ at: p.followupDate!.getTime(), title: p.propertyName, detail: `${label(p.status)} · Call list` });
  return rows.sort((a, b) => a.at - b.at).slice(0, 10).map(({ title, detail }) => ({ title, detail }));
}
