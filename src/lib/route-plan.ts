// Shared helpers for the Customers → Planner (route-planning scratchpad).
// Everything here is display/derivation logic — the planner only ever writes to
// the RoutePlanAssignment table, never to Sweep&Go.

import { parseServiceDays } from "@/lib/customer-schedule";

// One color per weekday (0=Sun … 6=Sat), tuned to sit alongside the violet admin
// theme rather than the office app's neon palette.
export const DAY_COLOR = [
  "#64748B", // Sun — slate
  "#7C5CFC", // Mon — iris
  "#F0369C", // Tue — magenta
  "#12A150", // Wed — grass
  "#F5A623", // Thu — gold
  "#3B82F6", // Fri — blue
  "#DC2626", // Sat — red (distinct from Fri's blue and Mon's violet)
];
export const UNASSIGNED = -1;
export const UNASSIGNED_COLOR = "#9A9AA5";

// Lane / chip order: Mon-first work week, then weekend, then Unassigned.
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** The planned day for a customer, as a number in {-1..6} where -1 = unassigned.
 *  Precedence (mirrors the Leads kanban): explicit assignment wins (including an
 *  explicit -1 = "parked"), else derive from their real Sweep&Go service day,
 *  else -1 (unassigned). */
export function plannedDay(
  customer: { id: string; serviceDays: string },
  assignments: Record<string, number>,
): number {
  const explicit = assignments[customer.id];
  if (explicit != null && explicit >= -1 && explicit <= 6) return explicit;
  const derived = parseServiceDays(customer.serviceDays)[0];
  return derived != null ? derived : UNASSIGNED;
}

/** Color for a planned day (or the unassigned gray). */
export function dayColor(day: number): string {
  return day < 0 ? UNASSIGNED_COLOR : DAY_COLOR[day] ?? UNASSIGNED_COLOR;
}

// ── Sanitization spray add-on ───────────────────────────────────────────────
// Sweep&Go lists a customer's subscriptions comma-joined, e.g.
// "2d-1xW,Sanitization Spray" with cleanupFrequency "Bi weekly,once a week".
// The spray is done on the customer's service day; its cadence is inferred from
// the plan code (scooping cadence) + the "other" cleanupFrequency entry.

export type SprayFreq = "weekly" | "biweekly" | "monthly";
export const SPRAY_COLOR = "#0D9488"; // teal — not one of the weekday colors

export const sprayLabel = (f: SprayFreq) =>
  f === "weekly" ? "Weekly" : f === "biweekly" ? "Bi-weekly" : "Monthly";

function normFreq(s: string): SprayFreq | "twice" | null {
  const f = s.toLowerCase();
  if (f.includes("two times") || f.includes("2x") || f.includes("twice")) return "twice";
  if (f.includes("bi")) return "biweekly";
  if (f.includes("month")) return "monthly";
  if (f.includes("week")) return "weekly";
  return null;
}

/** Sanitization-spray info for a customer, or null if they don't have it. */
export function sprayInfo(
  subscriptionNames?: string | null,
  cleanupFrequency?: string | null,
): { freq: SprayFreq } | null {
  if (!subscriptionNames || !/saniti/i.test(subscriptionNames)) return null;
  // Scooping cadence from the plan code, e.g. "2d-1xW" / "1d-bW" / "3d-2xW".
  const code = subscriptionNames.split(",").map((s) => s.trim()).find((s) => /\dd-/i.test(s)) || "";
  const scoop: SprayFreq | "twice" | null =
    /2xW/i.test(code) ? "twice" : /bW/i.test(code) ? "biweekly" : /1xW/i.test(code) ? "weekly" : null;
  const tokens = (cleanupFrequency || "").split(",").map(normFreq).filter((t): t is SprayFreq | "twice" => t !== null);
  // The spray's cadence is the cleanupFrequency entry that isn't the scooping's.
  const raw = tokens.find((t) => t !== scoop) ?? tokens[0] ?? scoop ?? "weekly";
  return { freq: raw === "twice" ? "weekly" : raw };
}

/** Stable 0/1 parity per customer, for splitting bi-weekly/monthly sprays across
 *  a Week A / Week B view (an estimate — real cadence parity lives in Sweep&Go). */
export function weekParity(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 2;
}
