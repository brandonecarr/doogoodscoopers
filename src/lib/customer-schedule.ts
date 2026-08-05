// Turns a customer's Sweep&Go "service days" into a weekly schedule for the
// map view's "Service Schedule" panel (the analog to Apple Maps "Busy Times").

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Parse "Friday" / "Monday,Thursday" → sorted weekday indices (0=Sun … 6=Sat). */
export function parseServiceDays(serviceDays?: string | null): number[] {
  if (!serviceDays) return [];
  const out = new Set<number>();
  for (const raw of serviceDays.split(/[,/]/)) {
    const p = raw.trim().toLowerCase();
    if (!p) continue;
    const i = DAY_NAMES.findIndex((d) => d.toLowerCase() === p || d.toLowerCase().startsWith(p.slice(0, 3)));
    if (i >= 0) out.add(i);
  }
  return [...out].sort((a, b) => a - b);
}

/** "Fri" / "Mon & Thu" — the headline day label. */
export function serviceDaysLabel(days: number[]): string {
  if (days.length === 0) return "Not scheduled";
  return days.map((d) => DAY_SHORT[d]).join(" & ");
}

/** The next date (from `from`, inclusive) that falls on one of the service days. */
export function nextVisit(days: number[], from: Date): Date | null {
  if (days.length === 0) return null;
  for (let add = 0; add < 14; add++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + add);
    if (days.includes(d.getDay())) return d;
  }
  return null;
}

/** Tidy a frequency string for the pill, e.g. "Once a week" → "Weekly". */
export function frequencyLabel(freq?: string | null): string {
  if (!freq) return "—";
  const f = freq.toLowerCase();
  if (f.includes("two times") || f.includes("2x") || f.includes("twice")) return "2× / week";
  if (f.includes("once a week") || f === "weekly") return "Weekly";
  if (f.includes("bi") ) return "Bi-weekly";
  if (f.includes("once a month") || f.includes("monthly")) return "Monthly";
  return freq;
}
