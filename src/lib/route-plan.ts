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
