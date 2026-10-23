// ─── OfficeTV board config ────────────────────────────────────────────────────
// The shape the Apple TV app stores in TvConfig (its Swift `BoardConfig`, JSON-encoded).
// Keep in sync with OfficeTV/Packages/BoardKit/Sources/BoardKit/Models/Board.swift.
// The TV knows how to draw every metric in CATALOG; anything else is rejected on save.

/**
 * A section's footprint on the TV's 4×3 grid: a preset name ("S" 1×1, "M" 2×1, "L" 2×2, "XL" 4×1,
 * "FULL" 4×3) or any "WxH" (columns × rows), e.g. "3x1" or "4x2". Use sizeOf() to build one.
 */
export type SectionSize = string;
export type SectionSource = "crm" | "pm" | "goal";
export type ElementType =
  | "goalProgress" | "countdown" | "metric" | "kanban" | "funnel" | "customerMix"
  | "taskBoard" | "routeProgress" | "barChart" | "list"
  | "reviews" | "wins" | "progress" | "weather" | "announcement";

export interface TvElement {
  type: ElementType;
  config: {
    metric?: string; display?: string; pipelineID?: string; boardID?: string; columnIDs?: string[];
    /** Hire trigger: the MRR (dollars) or customer count that pays for a tech. */
    target?: number;
    /** Field share: whose share to highlight (first name as in Sweep&Go). */
    person?: string;
    /** Weather: where (from the ZIP lookup). */
    latitude?: number; longitude?: number; place?: string;
    /** Announcement text. */
    text?: string;
  };
}
export interface TvSection { id: string; title: string; size: SectionSize; source: SectionSource; elements: TvElement[] }
/**
 * `hidden` keeps a board in the config without showing it on the TV (toggle on the Boards tab).
 * Admin-only: /api/tv/config strips hidden boards before the TV sees them and puts them back
 * when the TV saves, so the Swift model doesn't need the field.
 */
export interface TvBoard { id: string; title: string; sections: TvSection[]; hidden?: boolean }
export interface TvPipelineStage { id: string; name: string; shortName?: string; sourceStatuses: string[]; isWon: boolean }
export interface TvPipeline { id: string; name: string; stages: TvPipelineStage[] }
export interface TvHeroGoal {
  name: string;
  metric: "activeCustomers";
  segment: "all" | "residential" | "commercial";
  target: number;
  deadline: string; // ISO 8601
  milestones: number[];
  celebrate: boolean;
  eyebrow?: string;
}
export interface TvBoardConfig {
  boards: TvBoard[];
  heroGoal: TvHeroGoal;
  pipelines: TvPipeline[];
  autoRotate: boolean;
  rotateSeconds: number;
}

export const GRID = { cols: 4, rows: 3 } as const;
export interface SizeCells { cols: number; rows: number }
const PRESET_CELLS: Record<string, SizeCells> = {
  S: { cols: 1, rows: 1 }, M: { cols: 2, rows: 1 }, L: { cols: 2, rows: 2 }, XL: { cols: 4, rows: 1 }, FULL: { cols: 4, rows: 3 },
};
export const SIZE_PRESETS: SectionSize[] = ["S", "M", "L", "XL", "FULL"];

/** Columns × rows for a size, or null when the string isn't a size the TV understands. */
export function parseSize(size: unknown): SizeCells | null {
  if (typeof size !== "string") return null;
  const preset = PRESET_CELLS[size];
  if (preset) return preset;
  const m = /^([1-4])x([1-3])$/.exec(size);
  return m ? { cols: Number(m[1]), rows: Number(m[2]) } : null;
}
/** Like parseSize, but an unknown size counts as 1×1 (for drawing previews). */
export const sizeCells = (size: SectionSize): SizeCells => parseSize(size) ?? { cols: 1, rows: 1 };
/** The canonical size string for a footprint: the preset name when one matches, else "WxH". */
export function sizeOf(cols: number, rows: number): SectionSize {
  const c = Math.min(GRID.cols, Math.max(1, Math.round(cols)));
  const r = Math.min(GRID.rows, Math.max(1, Math.round(rows)));
  return SIZE_PRESETS.find((p) => PRESET_CELLS[p].cols === c && PRESET_CELLS[p].rows === r) ?? `${c}x${r}`;
}
/** "2×1", or "Full screen" for the whole board. */
export function sizeLabel(size: SectionSize): string {
  const { cols, rows } = sizeCells(size);
  return cols === GRID.cols && rows === GRID.rows ? "Full screen" : `${cols}×${rows}`;
}
/** True when a section of this size can show the catalog item (it meets the item's minimum). */
export function fitsItem(item: CatalogItem, size: SectionSize): boolean {
  const c = parseSize(size);
  return !!c && c.cols >= item.minSize.cols && c.rows >= item.minSize.rows;
}

/** Everything the TV can show. `displays` are the visual variants the TV understands. */
export interface CatalogItem {
  metric: string;
  label: string;
  hint: string;
  group: "Goals" | "Sweep&Go" | "Admin" | "Other";
  type: ElementType;
  source: SectionSource;
  /** The smallest footprint (columns × rows) the TV can draw this in; anything larger is fine. */
  minSize: SizeCells;
  defaultTitle: string;
  displays?: { value: string; label: string }[];
  usesPipeline?: boolean;
  /** Shows one of the custom Kanban boards (/admin/kanban). */
  usesKanbanBoard?: boolean;
  /** Extra settings this section needs in the editor. */
  fields?: ("target" | "person" | "place" | "text")[];
}

/** How many columns of a Kanban board fit on the TV at a given size (one-row sizes show a count per column). */
export function maxKanbanColumns(size: SectionSize): number {
  const { cols, rows } = sizeCells(size);
  if (rows < 2) return 5;
  return cols >= 4 ? 8 : cols === 3 ? 6 : 5;
}

export const CATALOG: CatalogItem[] = [
  { metric: "goal.hero", label: "Goal progress", hint: "Ring, days left, pace and milestone banner", group: "Goals", type: "goalProgress", source: "goal", minSize: { cols: 2, rows: 2 }, defaultTitle: "Goal" },
  { metric: "sng.active.residential", label: "Residential customers", hint: "Active count and this week's change", group: "Sweep&Go", type: "metric", source: "crm", minSize: { cols: 1, rows: 1 }, defaultTitle: "Residential" },
  { metric: "sng.active.commercial", label: "Commercial customers", hint: "Active count", group: "Sweep&Go", type: "metric", source: "crm", minSize: { cols: 1, rows: 1 }, defaultTitle: "Commercial" },
  { metric: "sng.happy.families", label: "Happy families", hint: "All-time happy clients (Sweep&Go)", group: "Sweep&Go", type: "metric", source: "crm", minSize: { cols: 1, rows: 1 }, defaultTitle: "Happy families" },
  { metric: "sng.happy.dogs", label: "Happy dogs", hint: "Dogs across all happy clients (Sweep&Go)", group: "Sweep&Go", type: "metric", source: "crm", minSize: { cols: 1, rows: 1 }, defaultTitle: "Happy dogs" },
  { metric: "sng.completed.yards", label: "Completed yards", hint: "All-time completed cleanups (Sweep&Go)", group: "Sweep&Go", type: "metric", source: "crm", minSize: { cols: 1, rows: 1 }, defaultTitle: "Completed yards" },
  { metric: "sng.fieldShare.week", label: "Field share", hint: "Share of this week's completed visits per tech", group: "Sweep&Go", type: "barChart", source: "pm", minSize: { cols: 2, rows: 1 }, defaultTitle: "Field share · this week", fields: ["person"] },
  { metric: "sng.routes.today", label: "Today's routes", hint: "Yards done of scheduled, per tech", group: "Sweep&Go", type: "routeProgress", source: "pm", minSize: { cols: 2, rows: 1 }, defaultTitle: "Today's routes",
    displays: [{ value: "crews", label: "A bar per tech" }, { value: "bar", label: "One overall bar" }] },
  { metric: "sng.visits.ontime.week", label: "On-time visits", hint: "Completed ÷ scheduled this week", group: "Sweep&Go", type: "metric", source: "pm", minSize: { cols: 1, rows: 1 }, defaultTitle: "On-time visits" },
  { metric: "sng.visits.rescheduled.week", label: "Rescheduled visits", hint: "Skipped + missed this week", group: "Sweep&Go", type: "metric", source: "pm", minSize: { cols: 1, rows: 1 }, defaultTitle: "Rescheduled · wk" },
  { metric: "sng.visits.byCrew.week", label: "Visits by crew", hint: "Completed visits per tech this week", group: "Sweep&Go", type: "barChart", source: "pm", minSize: { cols: 2, rows: 1 }, defaultTitle: "Visits this week by crew" },
  { metric: "sng.invoices", label: "Invoices", hint: "Paid so far on this month's invoices, last month's, or next month projected from every active subscription", group: "Sweep&Go", type: "metric", source: "crm", minSize: { cols: 1, rows: 1 }, defaultTitle: "Invoices · this month",
    displays: [{ value: "thisMonth", label: "Paid this month" }, { value: "lastMonth", label: "Paid last month" }, { value: "nextMonth", label: "Next month projection" }] },
  { metric: "sng.avgQuote.30d", label: "Average visit price", hint: "Completed visits, last 30 days", group: "Sweep&Go", type: "metric", source: "crm", minSize: { cols: 1, rows: 1 }, defaultTitle: "Avg visit · 30 days" },
  { metric: "crm.funnel.week", label: "This week's funnel", hint: "Leads → second stage → won", group: "Admin", type: "funnel", source: "crm", minSize: { cols: 2, rows: 1 }, defaultTitle: "This week's funnel", usesPipeline: true },
  { metric: "crm.pipeline", label: "Sales pipeline", hint: "One row tall: count per stage · two or more rows: cards per stage", group: "Admin", type: "kanban", source: "crm", minSize: { cols: 2, rows: 1 }, defaultTitle: "Sales pipeline", usesPipeline: true },
  { metric: "crm.leads.week", label: "New leads this week", hint: "Count, change and 8-week chart", group: "Admin", type: "barChart", source: "crm", minSize: { cols: 2, rows: 1 }, defaultTitle: "New leads this week", displays: [{ value: "trend", label: "Trend" }] },
  { metric: "crm.winrate.30d", label: "Win rate", hint: "Converted ÷ leads, last 30 days", group: "Admin", type: "metric", source: "crm", minSize: { cols: 1, rows: 1 }, defaultTitle: "Win rate · 30 days" },
  { metric: "crm.leadSources.30d", label: "Lead sources", hint: "Top four sources, last 30 days", group: "Admin", type: "barChart", source: "crm", minSize: { cols: 2, rows: 1 }, defaultTitle: "Lead sources · 30 days", displays: [{ value: "sources", label: "Sources grid" }] },
  { metric: "crm.followups.today", label: "Follow up today", hint: "Leads and call-list prospects due today", group: "Admin", type: "list", source: "crm", minSize: { cols: 2, rows: 1 }, defaultTitle: "Follow up today", displays: [{ value: "detail", label: "Name + detail" }] },
  { metric: "pm.tasks", label: "Task board", hint: "To do · In progress · Done this week", group: "Admin", type: "taskBoard", source: "pm", minSize: { cols: 2, rows: 1 }, defaultTitle: "Task board" },
  { metric: "pm.kanban", label: "Kanban board", hint: "One of your custom boards (Kanban page). Two or more rows tall: cards · one row: counts", group: "Admin", type: "kanban", source: "pm", minSize: { cols: 2, rows: 1 }, defaultTitle: "Board", usesKanbanBoard: true },
  { metric: "crm.reviews", label: "Reviews", hint: "Google star rating, reviews this month and the latest 5-star quote", group: "Admin", type: "reviews", source: "crm", minSize: { cols: 1, rows: 1 }, defaultTitle: "Google reviews" },
  { metric: "crm.wins", label: "Wins", hint: "New signups and 5-star reviews from the last two weeks, plus milestones", group: "Admin", type: "wins", source: "crm", minSize: { cols: 2, rows: 1 }, defaultTitle: "Wins" },
  { metric: "crm.avgMonthlyCost", label: "Average monthly cost", hint: "Every customer's invoices for the latest billed month, averaged per customer", group: "Admin", type: "metric", source: "crm", minSize: { cols: 1, rows: 1 }, defaultTitle: "Avg monthly cost" },
  { metric: "crm.revenue.month", label: "Revenue this month", hint: "Collected so far this month, with last month for comparison", group: "Admin", type: "metric", source: "crm", minSize: { cols: 1, rows: 1 }, defaultTitle: "Revenue this month" },
  { metric: "crm.margin.month", label: "Margin this month", hint: "Revenue minus costs (from the Profitability page)", group: "Admin", type: "metric", source: "crm", minSize: { cols: 1, rows: 1 }, defaultTitle: "Margin this month" },
  { metric: "crm.hireTrigger", label: "Hire trigger", hint: "Progress toward the number that pays for a tech", group: "Admin", type: "progress", source: "crm", minSize: { cols: 2, rows: 1 }, defaultTitle: "Hire a tech",
    displays: [{ value: "mrr", label: "Monthly recurring revenue" }, { value: "customers", label: "Active customers" }], fields: ["target"] },
  { metric: "crm.cancelReasons.90d", label: "Why customers leave", hint: "Cancellation reasons, last 90 days", group: "Admin", type: "barChart", source: "crm", minSize: { cols: 2, rows: 1 }, defaultTitle: "Why customers leave · 90 days" },
  { metric: "pm.calendar.upcoming", label: "Coming up", hint: "Calendar entries and task due dates", group: "Admin", type: "list", source: "pm", minSize: { cols: 2, rows: 1 }, defaultTitle: "Coming up", displays: [{ value: "dated", label: "Date + event" }] },
  { metric: "ext.weather", label: "Weather", hint: "Today and the next 3 days (U.S. National Weather Service)", group: "Other", type: "weather", source: "pm", minSize: { cols: 1, rows: 1 }, defaultTitle: "Weather", fields: ["place"] },
  { metric: "ext.announcement", label: "Announcement", hint: "A message you type, e.g. \"Welcome Sam!\"", group: "Other", type: "announcement", source: "pm", minSize: { cols: 1, rows: 1 }, defaultTitle: "Announcement", fields: ["text"] },
];

export const catalogItem = (metric?: string) => CATALOG.find((c) => c.metric === metric);

/** Every lead status in the admin (Prisma `LeadStatus`), for pipeline stages. */
export const LEAD_STATUSES: { value: string; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "QUOTED", label: "Quoted" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "PHONE_REVIEW", label: "Phone review" },
  { value: "NO_ANSWER", label: "No answer" },
  { value: "WAITING_FOR_SIGNUP", label: "Waiting for signup" },
  { value: "CONVERTED", label: "Converted" },
  { value: "NOT_INTERESTED", label: "Not interested" },
];

export function newSection(item: CatalogItem, pipelineID?: string, board?: { id: string; name: string }): TvSection {
  return {
    id: `s-${Math.random().toString(36).slice(2, 9)}`,
    title: item.usesKanbanBoard && board ? board.name : item.defaultTitle,
    size: sizeOf(item.minSize.cols, item.minSize.rows),
    source: item.source,
    elements: [{ type: item.type, config: {
      metric: item.metric,
      display: item.displays?.[0]?.value,
      pipelineID: item.usesPipeline ? pipelineID : undefined,
      boardID: item.usesKanbanBoard ? board?.id : undefined,
    } }],
  };
}

/** "100 residential customers by Jun 30" — matches the TV's automatic title. */
export function autoGoalTitle(target: number, segment: TvHeroGoal["segment"], deadline: string): string {
  const kind = segment === "all" ? "active customers" : `${segment} customers`;
  const d = new Date(deadline);
  return `${target} ${kind} by ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" })}`;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

/** Places sections on the 4×3 grid like CSS grid auto-flow: row (and the TV's GridPacker). */
export function packGrid(sizes: SectionSize[]): ({ col: number; row: number } | null)[] {
  const COLS = GRID.cols, ROWS = GRID.rows;
  const used = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  let cr = 0, cc = 0;
  return sizes.map((size) => {
    const { cols: w, rows: h } = sizeCells(size);
    let r = cr, c = cc;
    const fits = (r: number, c: number) => {
      if (c + w > COLS || r + h > ROWS) return false;
      for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (used[y][x]) return false;
      return true;
    };
    while (r < ROWS) {
      if (fits(r, c)) {
        for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) used[y][x] = true;
        cr = r; cc = c + w;
        return { col: c, row: r };
      }
      c++;
      if (c + w > COLS) { c = 0; r++; }
    }
    return null;
  });
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Problems that would stop the TV from drawing this config; empty when it's good to save.
 * Pass `kanbanBoardIds` (server side) to also check that chosen Kanban boards still exist.
 */
export function validateConfig(cfg: TvBoardConfig, kanbanBoardIds?: Set<string>): string[] {
  const errors: string[] = [];
  if (!Array.isArray(cfg.boards) || cfg.boards.length === 0) errors.push("Add at least one board.");
  else if (cfg.boards.every((b) => b.hidden)) errors.push("Turn on at least one board so the TV has something to show.");
  const pipelineIds = new Set((cfg.pipelines || []).map((p) => p.id));

  for (const board of cfg.boards || []) {
    const name = board.title?.trim() || "Untitled board";
    if (!board.title?.trim()) errors.push("Every board needs a title.");
    if (!board.sections?.length) errors.push(`${name}: add at least one section.`);
    const placements = packGrid((board.sections || []).map((s) => s.size));
    if (placements.some((p) => p === null)) errors.push(`${name}: the sections don't fit on the 4×3 grid.`);
    for (const s of board.sections || []) {
      const el = s.elements?.[0];
      const item = catalogItem(el?.config?.metric);
      if (!item) { errors.push(`${name}: "${s.title}" shows something the TV doesn't know.`); continue; }
      if (!parseSize(s.size)) errors.push(`${name}: "${s.title}" has a size the TV doesn't understand (${String(s.size)}).`);
      else if (!fitsItem(item, s.size)) errors.push(`${name}: "${s.title}" needs at least ${item.minSize.cols}×${item.minSize.rows} (it's ${sizeLabel(s.size)}).`);
      if (!s.title?.trim()) errors.push(`${name}: a section is missing its title.`);
      if (item.usesPipeline && el?.config.pipelineID && !pipelineIds.has(el.config.pipelineID)) errors.push(`${name}: "${s.title}" uses a pipeline that no longer exists.`);
      if (item.fields?.includes("target") && !((el?.config.target ?? 0) > 0)) errors.push(`${name}: set the target for "${s.title}".`);
      if (item.fields?.includes("place") && (el?.config.latitude == null || el?.config.longitude == null)) errors.push(`${name}: look up a ZIP code for "${s.title}".`);
      if (item.fields?.includes("text") && !el?.config.text?.trim()) errors.push(`${name}: type the message for "${s.title}".`);
      if (item.usesKanbanBoard) {
        if (!el?.config.boardID) errors.push(`${name}: pick which Kanban board "${s.title}" shows.`);
        else if (kanbanBoardIds && !kanbanBoardIds.has(el.config.boardID)) errors.push(`${name}: "${s.title}" shows a Kanban board that was deleted.`);
        const max = maxKanbanColumns(s.size);
        if ((el?.config.columnIDs?.length ?? 0) > max) errors.push(`${name}: "${s.title}" can show at most ${max} columns at this size.`);
      }
    }
  }

  const g = cfg.heroGoal;
  if (!g || !(g.target > 0)) errors.push("The goal needs a target above zero.");
  if (!g?.deadline || isNaN(new Date(g.deadline).getTime())) errors.push("The goal needs a deadline.");
  if (!g?.name?.trim()) errors.push("The goal needs a title.");

  for (const p of cfg.pipelines || []) {
    if (!p.stages?.length) errors.push(`Pipeline "${p.name}" needs at least one stage.`);
    if (p.stages?.some((s) => !s.name?.trim())) errors.push(`Pipeline "${p.name}": every stage needs a name.`);
    if (p.stages?.some((s) => s.sourceStatuses.some((st) => !LEAD_STATUSES.some((l) => l.value === st)))) errors.push(`Pipeline "${p.name}": unknown lead status.`);
  }
  if (typeof cfg.rotateSeconds !== "number" || typeof cfg.autoRotate !== "boolean") errors.push("Rotation settings are missing.");
  return errors;
}

/** The design's three boards, used until a TV or this page saves a config. Mirrors BoardConfig.designDefault(). */
export function defaultConfig(now = new Date()): TvBoardConfig {
  const year = Number(now.toLocaleDateString("en-US", { year: "numeric", timeZone: "America/Los_Angeles" }));
  const sec = (id: string, title: string, size: SectionSize, source: SectionSource, type: ElementType, metric: string, display?: string, pipelineID?: string): TvSection =>
    ({ id, title, size, source, elements: [{ type, config: { metric, ...(display ? { display } : {}), ...(pipelineID ? { pipelineID } : {}) } }] });
  return {
    boards: [
      { id: "growth", title: "Growth Board", sections: [
        sec("hero", "Q4 goal", "L", "goal", "goalProgress", "goal.hero"),
        sec("funnel", "This week's funnel", "M", "crm", "funnel", "crm.funnel.week"),
        sec("routes", "Today's routes", "M", "pm", "routeProgress", "sng.routes.today", "crews"),
        sec("residential", "Residential", "S", "crm", "metric", "sng.active.residential"),
        sec("commercial", "Commercial", "S", "crm", "metric", "sng.active.commercial"),
        sec("pipeline", "Pipeline board", "M", "crm", "kanban", "crm.pipeline", undefined, "sales"),
      ] },
      { id: "operations", title: "Operations Board", sections: [
        sec("tasks", "Task board", "L", "pm", "taskBoard", "pm.tasks"),
        sec("ops-routes", "Today's routes", "M", "pm", "routeProgress", "sng.routes.today", "bar"),
        sec("ontime", "On-time visits", "S", "pm", "metric", "sng.visits.ontime.week"),
        sec("rescheduled", "Rescheduled · wk", "S", "pm", "metric", "sng.visits.rescheduled.week"),
        sec("crew-visits", "Visits this week by crew", "M", "pm", "barChart", "sng.visits.byCrew.week"),
        sec("coming-up", "Coming up", "M", "pm", "list", "pm.calendar.upcoming", "dated"),
      ] },
      { id: "sales", title: "Sales Board", sections: [
        sec("new-leads", "New leads this week", "M", "crm", "barChart", "crm.leads.week", "trend"),
        sec("sales-pipeline", "Sales pipeline", "L", "crm", "kanban", "crm.pipeline", undefined, "sales"),
        sec("win-rate", "Win rate · 30 days", "S", "crm", "metric", "crm.winrate.30d"),
        sec("avg-cost", "Avg monthly cost", "S", "crm", "metric", "crm.avgMonthlyCost"),
        sec("lead-sources", "Lead sources · 30 days", "M", "crm", "barChart", "crm.leadSources.30d", "sources"),
        sec("follow-up", "Follow up today", "M", "crm", "list", "crm.followups.today", "detail"),
      ] },
    ],
    heroGoal: { name: "500 active customers by Dec 31", metric: "activeCustomers", segment: "all", target: 500, deadline: new Date(Date.UTC(year, 11, 31, 8)).toISOString(), milestones: [400, 450, 500], celebrate: true },
    pipelines: [{ id: "sales", name: "Sales pipeline", stages: [
      { id: "new", name: "New lead", shortName: "New", sourceStatuses: ["NEW"], isWon: false },
      { id: "quoted", name: "Quoted", sourceStatuses: ["QUOTED", "CONTACTED", "PHONE_REVIEW"], isWon: false },
      { id: "first-visit", name: "First visit", shortName: "1st visit", sourceStatuses: ["WAITING_FOR_SIGNUP"], isWon: false },
      { id: "won", name: "Won", sourceStatuses: ["CONVERTED"], isWon: true },
    ] }],
    autoRotate: true,
    rotateSeconds: 120,
  };
}
