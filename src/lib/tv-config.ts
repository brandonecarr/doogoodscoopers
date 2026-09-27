// ─── OfficeTV board config ────────────────────────────────────────────────────
// The shape the Apple TV app stores in TvConfig (its Swift `BoardConfig`, JSON-encoded).
// Keep in sync with OfficeTV/Packages/BoardKit/Sources/BoardKit/Models/Board.swift.
// The TV knows how to draw every metric in CATALOG; anything else is rejected on save.

export type SectionSize = "S" | "M" | "L" | "XL";
export type SectionSource = "crm" | "pm" | "goal";
export type ElementType =
  | "goalProgress" | "countdown" | "metric" | "kanban" | "funnel" | "customerMix"
  | "taskBoard" | "routeProgress" | "barChart" | "list";

export interface TvElement {
  type: ElementType;
  config: { metric?: string; display?: string; pipelineID?: string; boardID?: string; columnIDs?: string[] };
}
export interface TvSection { id: string; title: string; size: SectionSize; source: SectionSource; elements: TvElement[] }
export interface TvBoard { id: string; title: string; sections: TvSection[] }
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

export const SIZE_CELLS: Record<SectionSize, { cols: number; rows: number }> = {
  S: { cols: 1, rows: 1 }, M: { cols: 2, rows: 1 }, L: { cols: 2, rows: 2 }, XL: { cols: 4, rows: 1 },
};
export const SIZE_LABEL: Record<SectionSize, string> = { S: "S · 1×1", M: "M · 2×1", L: "L · 2×2", XL: "XL · 4×1" };

/** Everything the TV can show. `displays` are the visual variants the TV understands. */
export interface CatalogItem {
  metric: string;
  label: string;
  hint: string;
  group: "Goals" | "Sweep&Go" | "Admin";
  type: ElementType;
  source: SectionSource;
  sizes: SectionSize[];
  defaultTitle: string;
  displays?: { value: string; label: string }[];
  usesPipeline?: boolean;
  /** Shows one of the custom Kanban boards (/admin/kanban). */
  usesKanbanBoard?: boolean;
}

/** The TV shows at most this many columns of a Kanban board. */
export const MAX_TV_KANBAN_COLUMNS = 5;

export const CATALOG: CatalogItem[] = [
  { metric: "goal.hero", label: "Goal progress", hint: "Ring, days left, pace and milestone banner", group: "Goals", type: "goalProgress", source: "goal", sizes: ["L"], defaultTitle: "Goal" },
  { metric: "sng.active.residential", label: "Residential customers", hint: "Active count and this week's change", group: "Sweep&Go", type: "metric", source: "crm", sizes: ["S"], defaultTitle: "Residential" },
  { metric: "sng.active.commercial", label: "Commercial customers", hint: "Active count", group: "Sweep&Go", type: "metric", source: "crm", sizes: ["S"], defaultTitle: "Commercial" },
  { metric: "sng.routes.today", label: "Today's routes", hint: "Yards done of scheduled, per tech", group: "Sweep&Go", type: "routeProgress", source: "pm", sizes: ["M", "XL"], defaultTitle: "Today's routes",
    displays: [{ value: "crews", label: "A bar per tech" }, { value: "bar", label: "One overall bar" }] },
  { metric: "sng.visits.ontime.week", label: "On-time visits", hint: "Completed ÷ scheduled this week", group: "Sweep&Go", type: "metric", source: "pm", sizes: ["S"], defaultTitle: "On-time visits" },
  { metric: "sng.visits.rescheduled.week", label: "Rescheduled visits", hint: "Skipped + missed this week", group: "Sweep&Go", type: "metric", source: "pm", sizes: ["S"], defaultTitle: "Rescheduled · wk" },
  { metric: "sng.visits.byCrew.week", label: "Visits by crew", hint: "Completed visits per tech this week", group: "Sweep&Go", type: "barChart", source: "pm", sizes: ["M", "L"], defaultTitle: "Visits this week by crew" },
  { metric: "sng.avgQuote.30d", label: "Average visit price", hint: "Completed visits, last 30 days", group: "Sweep&Go", type: "metric", source: "crm", sizes: ["S"], defaultTitle: "Avg visit · 30 days" },
  { metric: "crm.funnel.week", label: "This week's funnel", hint: "Leads → second stage → won", group: "Admin", type: "funnel", source: "crm", sizes: ["M", "L", "XL"], defaultTitle: "This week's funnel", usesPipeline: true },
  { metric: "crm.pipeline", label: "Sales pipeline", hint: "M/XL: count per stage · L: cards per stage", group: "Admin", type: "kanban", source: "crm", sizes: ["M", "L", "XL"], defaultTitle: "Sales pipeline", usesPipeline: true },
  { metric: "crm.leads.week", label: "New leads this week", hint: "Count, change and 8-week chart", group: "Admin", type: "barChart", source: "crm", sizes: ["M", "XL"], defaultTitle: "New leads this week", displays: [{ value: "trend", label: "Trend" }] },
  { metric: "crm.winrate.30d", label: "Win rate", hint: "Converted ÷ leads, last 30 days", group: "Admin", type: "metric", source: "crm", sizes: ["S"], defaultTitle: "Win rate · 30 days" },
  { metric: "crm.leadSources.30d", label: "Lead sources", hint: "Top four sources, last 30 days", group: "Admin", type: "barChart", source: "crm", sizes: ["M"], defaultTitle: "Lead sources · 30 days", displays: [{ value: "sources", label: "Sources grid" }] },
  { metric: "crm.followups.today", label: "Follow up today", hint: "Leads and call-list prospects due today", group: "Admin", type: "list", source: "crm", sizes: ["M", "L"], defaultTitle: "Follow up today", displays: [{ value: "detail", label: "Name + detail" }] },
  { metric: "pm.tasks", label: "Task board", hint: "To do · In progress · Done this week", group: "Admin", type: "taskBoard", source: "pm", sizes: ["M", "L"], defaultTitle: "Task board" },
  { metric: "pm.kanban", label: "Kanban board", hint: "One of your custom boards (Kanban page). L: cards · M/XL: counts", group: "Admin", type: "kanban", source: "pm", sizes: ["L", "M", "XL"], defaultTitle: "Board", usesKanbanBoard: true },
  { metric: "pm.calendar.upcoming", label: "Coming up", hint: "Calendar entries and task due dates", group: "Admin", type: "list", source: "pm", sizes: ["M", "L"], defaultTitle: "Coming up", displays: [{ value: "dated", label: "Date + event" }] },
];

export const catalogItem = (metric?: string) => CATALOG.find((c) => c.metric === metric);

/** Every lead status in the admin (Prisma `LeadStatus`), for pipeline stages. */
export const LEAD_STATUSES: { value: string; label: string }[] = [
  { value: "NEW", label: "New" },
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
    size: item.sizes[0],
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
  const COLS = 4, ROWS = 3;
  const used = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  let cr = 0, cc = 0;
  return sizes.map((size) => {
    const { cols: w, rows: h } = SIZE_CELLS[size];
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
      if (!item.sizes.includes(s.size)) errors.push(`${name}: "${s.title}" can't be size ${s.size} (use ${item.sizes.join(" or ")}).`);
      if (!s.title?.trim()) errors.push(`${name}: a section is missing its title.`);
      if (item.usesPipeline && el?.config.pipelineID && !pipelineIds.has(el.config.pipelineID)) errors.push(`${name}: "${s.title}" uses a pipeline that no longer exists.`);
      if (item.usesKanbanBoard) {
        if (!el?.config.boardID) errors.push(`${name}: pick which Kanban board "${s.title}" shows.`);
        else if (kanbanBoardIds && !kanbanBoardIds.has(el.config.boardID)) errors.push(`${name}: "${s.title}" shows a Kanban board that was deleted.`);
        if ((el?.config.columnIDs?.length ?? 0) > MAX_TV_KANBAN_COLUMNS) errors.push(`${name}: "${s.title}" can show at most ${MAX_TV_KANBAN_COLUMNS} columns.`);
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
        sec("avg-quote", "Avg visit · 30 days", "S", "crm", "metric", "sng.avgQuote.30d"),
        sec("lead-sources", "Lead sources · 30 days", "M", "crm", "barChart", "crm.leadSources.30d", "sources"),
        sec("follow-up", "Follow up today", "M", "crm", "list", "crm.followups.today", "detail"),
      ] },
    ],
    heroGoal: { name: "500 active customers by Dec 31", metric: "activeCustomers", segment: "all", target: 500, deadline: new Date(Date.UTC(year, 11, 31, 8)).toISOString(), milestones: [400, 450, 500], celebrate: true },
    pipelines: [{ id: "sales", name: "Sales pipeline", stages: [
      { id: "new", name: "New lead", shortName: "New", sourceStatuses: ["NEW"], isWon: false },
      { id: "quoted", name: "Quoted", sourceStatuses: ["CONTACTED", "PHONE_REVIEW"], isWon: false },
      { id: "first-visit", name: "First visit", shortName: "1st visit", sourceStatuses: ["WAITING_FOR_SIGNUP"], isWon: false },
      { id: "won", name: "Won", sourceStatuses: ["CONVERTED"], isWon: true },
    ] }],
    autoRotate: true,
    rotateSeconds: 120,
  };
}
