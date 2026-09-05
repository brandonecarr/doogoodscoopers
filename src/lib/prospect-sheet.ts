/**
 * Turn a raw grid (CSV or one Excel sheet, as array-of-arrays) into row
 * objects keyed by header. Research spreadsheets are rarely clean tables:
 * a title and a blurb sit above the header row, cities get "▶ CITY" section
 * rows, and a legend sits in a merged footer. So the header row is detected
 * rather than assumed, and rows that only fill one cell are dropped.
 */
export type Grid = string[][];
export type SheetRow = { data: Record<string, string>; rowNumber: number };

const HEADER_WORDS = /property|community|hoa|association|name|city|phone|address|contact|zip|email|notes|type|units|status|rating|why/i;

/** Index of the row that looks most like a header row, or -1. */
export function findHeaderRow(grid: Grid): number {
  let best = -1, bestScore = 0;
  for (let i = 0; i < Math.min(grid.length, 25); i++) {
    const cells = grid[i].map((c) => (c || "").trim()).filter(Boolean);
    if (cells.length < 2) continue;
    // Header cells are short labels, most of them recognisable words.
    const hits = cells.filter((c) => c.length <= 40 && HEADER_WORDS.test(c)).length;
    const score = hits * 2 + cells.length;
    if (hits >= 2 && score > bestScore) { best = i; bestScore = score; }
  }
  return best;
}

export function gridToRows(grid: Grid): SheetRow[] {
  const h = findHeaderRow(grid);
  if (h < 0) return [];
  const headers = grid[h].map((c) => (c || "").trim());
  const out: SheetRow[] = [];
  for (let i = h + 1; i < grid.length; i++) {
    const cells = grid[i].map((c) => (c ?? "").toString().trim());
    const filled = cells.filter(Boolean);
    if (filled.length === 0) continue;
    // Section headers ("▶ ADELANTO"), legends and footers fill a single cell.
    if (filled.length === 1) continue;
    const data: Record<string, string> = {};
    headers.forEach((k, j) => { if (k && cells[j]) data[k] = cells[j]; });
    if (Object.keys(data).length) out.push({ data, rowNumber: i + 1 });
  }
  return out;
}

/** Minimal CSV → grid: quoted fields, embedded commas/newlines, CRLF. */
export function parseCsvGrid(text: string): Grid {
  const rows: Grid = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
