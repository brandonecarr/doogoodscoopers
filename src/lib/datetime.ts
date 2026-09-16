// ─── Single source of truth for dates & times ─────────────────────────────────
// The business runs in one timezone. Everything the user sees or types is in that
// timezone, whether the code runs on the (UTC) server or in the browser. Instants
// are always stored in the database as UTC; these helpers convert at the edges.
//
// Why this exists: a `datetime-local` input speaks *wall-clock* time. Populating
// one with `date.toISOString().slice(0,16)` feeds it UTC wall-clock, and reading
// it back as a bare string lets a UTC server re-interpret it as UTC — so a time
// the user picked in Pacific was getting stored shifted by the offset (~7h). All
// input round-trips must go through fromDateTimeLocalValue / toDateTimeLocalValue.

export const BUSINESS_TZ = "America/Los_Angeles";

function partsInTz(instant: Date): { y: number; mo: number; d: number; hh: number; mm: number; ss: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) if (part.type !== "literal") p[part.type] = part.value;
  let hh = Number(p.hour);
  if (hh === 24) hh = 0; // some engines emit "24" at midnight
  return { y: Number(p.year), mo: Number(p.month), d: Number(p.day), hh, mm: Number(p.minute), ss: Number(p.second) };
}

// Minutes that BUSINESS_TZ is ahead of UTC at a given instant (negative in the US).
function tzOffsetMinutes(instant: Date): number {
  const { y, mo, d, hh, mm, ss } = partsInTz(instant);
  const asIfUTC = Date.UTC(y, mo - 1, d, hh, mm, ss);
  return Math.round((asIfUTC - instant.getTime()) / 60000);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** UTC instant → "YYYY-MM-DDTHH:mm" wall-clock in BUSINESS_TZ (for datetime-local inputs). */
export function toDateTimeLocalValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const { y, mo, d: dd, hh, mm } = partsInTz(d);
  return `${y}-${pad(mo)}-${pad(dd)}T${pad(hh)}:${pad(mm)}`;
}

/** UTC instant → "YYYY-MM-DD" wall-clock in BUSINESS_TZ (for date inputs). */
export function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const { y, mo, d: dd } = partsInTz(d);
  return `${y}-${pad(mo)}-${pad(dd)}`;
}

/**
 * "YYYY-MM-DDTHH:mm" (or "YYYY-MM-DD") wall-clock in BUSINESS_TZ → UTC ISO string.
 * Interprets the value as Pacific time regardless of where this runs.
 */
export function fromDateTimeLocalValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const [datePart, timePart = "00:00"] = value.split("T");
  const [y, mo, da] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  if (!y || !mo || !da) return null;
  const guess = Date.UTC(y, mo - 1, da, h || 0, mi || 0);
  const offset = tzOffsetMinutes(new Date(guess));
  return new Date(guess - offset * 60000).toISOString();
}

/** A date-only input → UTC ISO, anchored at Pacific noon so it never lands on the wrong day. */
export function fromDateInputValue(value: string | null | undefined): string | null {
  if (!value) return null;
  return fromDateTimeLocalValue(`${value}T12:00`);
}

// ─── Display formatters (always render in BUSINESS_TZ) ─────────────────────────
export function formatDateTime(
  date: Date | string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { timeZone: BUSINESS_TZ, ...opts });
}

export function formatDate(
  date: Date | string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { timeZone: BUSINESS_TZ, ...opts });
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { timeZone: BUSINESS_TZ, hour: "numeric", minute: "2-digit" });
}
