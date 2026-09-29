import prisma from "@/lib/prisma";

// ── Keyword Planner uploads ──────────────────────────────────────────────────
// Google Ads API production access isn't available, so real search volume comes
// from the CSV that Keyword Planner exports ("Historical metrics" or "Keyword
// ideas" download). That file is UTF-16LE, tab-separated, and starts with two
// title rows before the header; a Google-Sheets re-save is UTF-8 comma CSV.
// Low-spend accounts see bucketed volumes ("1K – 10K") instead of exact numbers,
// so ranges are kept as-is for display and the low end is used for sorting.

export const normTerm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export interface PlannerRow {
  term: string;               // normalized
  displayTerm: string;
  monthlySearches: number | null;
  searchesLow: number | null;
  searchesHigh: number | null;
  volumeLabel: string | null;
  competition: string | null; // LOW | MEDIUM | HIGH
  competitionIndex: number | null;
  topBidLow: number | null;
  topBidHigh: number | null;
  threeMonthChange: string | null;
  yoyChange: string | null;
}

export type ParseResult = { ok: true; rows: PlannerRow[]; skipped: number } | { ok: false; error: string };

function decode(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder("utf-8").decode(bytes.subarray(3));
  // No BOM: UTF-16LE text has a NUL in most odd byte positions.
  const sample = bytes.subarray(0, Math.min(bytes.length, 400));
  let oddNuls = 0;
  for (let i = 1; i < sample.length; i += 2) if (sample[i] === 0) oddNuls++;
  if (sample.length > 20 && oddNuls > sample.length / 4) return new TextDecoder("utf-16le").decode(bytes);
  return new TextDecoder("utf-8").decode(bytes);
}

/** Split delimited text into rows, honoring double-quoted fields. */
function parseDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const header = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** "1,300" → 1300 · "1K" → 1000 · "1.5M" → 1500000 */
function parseAbbrev(raw: string): number | null {
  const m = raw.replace(/[,\s$]/g, "").match(/^(\d+(?:\.\d+)?)([kKmM]?)$/);
  if (!m) return null;
  const mult = m[2].toLowerCase() === "k" ? 1_000 : m[2].toLowerCase() === "m" ? 1_000_000 : 1;
  return Math.round(parseFloat(m[1]) * mult);
}

function parseVolume(raw: string): Pick<PlannerRow, "monthlySearches" | "searchesLow" | "searchesHigh" | "volumeLabel"> {
  const empty = { monthlySearches: null, searchesLow: null, searchesHigh: null, volumeLabel: null };
  const t = raw.trim();
  if (!t || t === "--" || t === "-") return empty;
  const parts = t.split(/\s*[–—-]\s*/).filter(Boolean);
  if (parts.length === 2) {
    const low = parseAbbrev(parts[0]);
    const high = parseAbbrev(parts[1]);
    if (low == null || high == null) return empty;
    return { monthlySearches: low, searchesLow: low, searchesHigh: high, volumeLabel: `${parts[0].trim()}–${parts[1].trim()}` };
  }
  const n = parseAbbrev(t);
  if (n == null) return empty;
  return { monthlySearches: n, searchesLow: n, searchesHigh: n, volumeLabel: n.toLocaleString("en-US") };
}

function parseMoney(raw: string): number | null {
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function parseCompetition(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (t.startsWith("low")) return "LOW";
  if (t.startsWith("med")) return "MEDIUM";
  if (t.startsWith("high")) return "HIGH";
  return null;
}

const text = (raw: string | undefined) => (raw && raw.trim() && raw.trim() !== "--" ? raw.trim() : null);

/** Parse a Keyword Planner export (Historical metrics or Keyword ideas). */
export function parseKeywordPlannerCsv(bytes: Uint8Array): ParseResult {
  const content = decode(bytes);

  // Find the header row (Google puts title rows above it) and its delimiter.
  let table: string[][] | null = null;
  let headerIdx = -1;
  for (const delim of ["\t", ",", ";"]) {
    const rows = parseDelimited(content, delim);
    const idx = rows.slice(0, 15).findIndex((r) => {
      const h = r.map(header);
      return h.includes("keyword") && h.some((c) => c.startsWith("avg. monthly searches") || c.startsWith("avg monthly searches"));
    });
    if (idx !== -1) { table = rows; headerIdx = idx; break; }
  }
  if (!table) {
    return {
      ok: false,
      error: "This doesn't look like a Keyword Planner export — no \"Keyword\" and \"Avg. monthly searches\" columns. Download \"Historical metrics\" or \"Keyword ideas\" as .csv from Keyword Planner.",
    };
  }

  const cols = table[headerIdx].map(header);
  const col = (pred: (h: string) => boolean) => cols.findIndex(pred);
  const iKeyword = col((h) => h === "keyword");
  const iVolume = col((h) => h.startsWith("avg. monthly searches") || h.startsWith("avg monthly searches"));
  const iThree = col((h) => h.startsWith("three month change"));
  const iYoy = col((h) => h.startsWith("yoy change"));
  const iComp = col((h) => h === "competition");
  const iCompIdx = col((h) => h.startsWith("competition (indexed"));
  const iBidLow = col((h) => h.startsWith("top of page bid (low"));
  const iBidHigh = col((h) => h.startsWith("top of page bid (high"));

  const byTerm = new Map<string, PlannerRow>();
  let skipped = 0;
  for (const r of table.slice(headerIdx + 1)) {
    const display = (r[iKeyword] ?? "").trim();
    if (!display || display.length > 150) { if (r.some((c) => c.trim())) skipped++; continue; }
    const term = normTerm(display);
    const compIdx = iCompIdx >= 0 ? parseInt((r[iCompIdx] ?? "").replace(/[^0-9]/g, ""), 10) : NaN;
    byTerm.set(term, {
      term,
      displayTerm: display,
      ...parseVolume(r[iVolume] ?? ""),
      competition: iComp >= 0 ? parseCompetition(r[iComp] ?? "") : null,
      competitionIndex: Number.isFinite(compIdx) ? compIdx : null,
      topBidLow: iBidLow >= 0 ? parseMoney(r[iBidLow] ?? "") : null,
      topBidHigh: iBidHigh >= 0 ? parseMoney(r[iBidHigh] ?? "") : null,
      threeMonthChange: iThree >= 0 ? text(r[iThree]) : null,
      yoyChange: iYoy >= 0 ? text(r[iYoy]) : null,
    });
  }

  const rows = [...byTerm.values()];
  if (!rows.length) return { ok: false, error: "The file has the right columns but no keyword rows." };
  return { ok: true, rows, skipped };
}

/** Save parsed rows to the library; a keyword's newer numbers replace older ones. */
export async function saveKeywordVolumes(rows: PlannerRow[], sourceFile: string): Promise<number> {
  const uploadedAt = new Date();
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    await prisma.$transaction(
      chunk.map((r) => {
        const data = { ...r, sourceFile, uploadedAt };
        return prisma.keywordVolume.upsert({ where: { term: r.term }, create: data, update: data });
      }),
    );
  }
  return rows.length;
}

/** Library rows for the given terms, keyed by normalized term. */
export async function keywordVolumesFor(terms: string[]) {
  const norms = [...new Set(terms.map(normTerm))];
  if (!norms.length) return new Map<string, Awaited<ReturnType<typeof prisma.keywordVolume.findMany>>[number]>();
  const rows = await prisma.keywordVolume.findMany({ where: { term: { in: norms } } });
  return new Map(rows.map((r) => [r.term, r]));
}

/** Fill search volume / competition / bids on a report's items from the library. */
export async function applyVolumesToReport(reportId: string): Promise<number> {
  const items = await prisma.keywordItem.findMany({ where: { reportId }, select: { id: true, term: true } });
  const vols = await keywordVolumesFor(items.map((i) => i.term));
  let matched = 0;
  for (const it of items) {
    const v = vols.get(normTerm(it.term));
    if (!v) continue;
    matched++;
    await prisma.keywordItem.update({
      where: { id: it.id },
      data: {
        monthlySearches: v.monthlySearches, volumeLabel: v.volumeLabel, competition: v.competition,
        topBidLow: v.topBidLow, topBidHigh: v.topBidHigh,
      },
    });
  }
  return matched;
}

export async function keywordVolumeStats(): Promise<{ count: number; lastUploadedAt: string | null; lastFile: string | null }> {
  const [count, last] = await Promise.all([
    prisma.keywordVolume.count(),
    prisma.keywordVolume.findFirst({ orderBy: { uploadedAt: "desc" }, select: { uploadedAt: true, sourceFile: true } }),
  ]);
  return { count, lastUploadedAt: last?.uploadedAt.toISOString() ?? null, lastFile: last?.sourceFile ?? null };
}

// Keyword Planner "ideas" can include off-topic terms (dog poop bags, DIY);
// only surface library terms that are about the service and aren't obvious negatives.
const ON_TOPIC = /poop|waste|scoop|dog|pet|dung|feces|yard clean/;
const OFF_TOPIC = /\bbags?\b|\bfree\b|\bdiy\b|how to|\bjobs?\b|salary|hiring|wholesale|franchise|\bmachine\b|\bvacuum\b/;

/** Highest-volume on-topic library terms (for the agent's prompt and extra ideas). */
export async function topLibraryTerms(limit: number) {
  const rows = await prisma.keywordVolume.findMany({
    where: { monthlySearches: { not: null } },
    orderBy: { monthlySearches: "desc" },
    take: limit * 4,
  });
  return rows.filter((r) => ON_TOPIC.test(r.term) && !OFF_TOPIC.test(r.term)).slice(0, limit);
}
