import prisma from "@/lib/prisma";

// Quiet hours for drip sends: never text a lead in the middle of the night.
// A lead may come in at 1am; without this the next step could fire at 3am.
// Configurable via AppSetting (keys under "drips.window."), business-timezone
// aware. Defaults to 8am–8pm America/Los_Angeles (within the TCPA 8am–9pm rule).

export interface SendWindow {
  enabled: boolean;
  startHour: number; // 0–23, inclusive
  endHour: number; // 1–24, exclusive
  timeZone: string; // IANA, e.g. "America/Los_Angeles"
}

export const DEFAULT_SEND_WINDOW: SendWindow = {
  enabled: true,
  startHour: 8,
  endHour: 20,
  timeZone: "America/Los_Angeles",
};

function validTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock parts of an instant in a given time zone. */
function tzParts(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const m: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) if (p.type !== "literal") m[p.type] = p.value;
  return {
    year: +m.year,
    month: +m.month,
    day: +m.day,
    hour: +m.hour % 24, // some engines emit "24" for midnight
    minute: +m.minute,
    second: +m.second,
  };
}

/** Time-zone offset (ms) from UTC at a given instant. Negative west of UTC. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const p = tzParts(date, timeZone);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - date.getTime();
}

/** Convert a wall-clock time in `timeZone` to the matching UTC instant. */
function zonedWallClockToUtc(y: number, mo: number, d: number, h: number, mi: number, timeZone: string): Date {
  const naive = Date.UTC(y, mo - 1, d, h, mi, 0);
  const offset = tzOffsetMs(new Date(naive), timeZone);
  return new Date(naive - offset);
}

/** Is this instant inside the send window? */
export function isWithinSendWindow(date: Date, win: SendWindow = DEFAULT_SEND_WINDOW): boolean {
  if (!win.enabled) return true;
  if (win.startHour <= 0 && win.endHour >= 24) return true;
  const { hour } = tzParts(date, win.timeZone);
  return hour >= win.startHour && hour < win.endHour;
}

/**
 * Return `desired` if it lands inside the send window, otherwise the next
 * window-open instant (today's open if we're before it, else tomorrow's).
 */
export function clampToSendWindow(desired: Date, win: SendWindow = DEFAULT_SEND_WINDOW): Date {
  if (!win.enabled) return desired;
  if (win.startHour <= 0 && win.endHour >= 24) return desired;
  const p = tzParts(desired, win.timeZone);
  if (p.hour >= win.startHour && p.hour < win.endHour) return desired;
  if (p.hour < win.startHour) {
    return zonedWallClockToUtc(p.year, p.month, p.day, win.startHour, 0, win.timeZone);
  }
  // Past the window today → open at startHour tomorrow (local date).
  const next = tzParts(new Date(desired.getTime() + 86_400_000), win.timeZone);
  return zonedWallClockToUtc(next.year, next.month, next.day, win.startHour, 0, win.timeZone);
}

/** Load the configured send window from AppSetting, falling back to defaults. */
export async function loadSendWindow(): Promise<SendWindow> {
  const rows = await prisma.appSetting.findMany({ where: { key: { startsWith: "drips.window." } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const start = parseInt(map["drips.window.startHour"] ?? "", 10);
  const end = parseInt(map["drips.window.endHour"] ?? "", 10);
  const tz = map["drips.window.timezone"];

  const startHour = Number.isFinite(start) && start >= 0 && start <= 23 ? start : DEFAULT_SEND_WINDOW.startHour;
  const endHour = Number.isFinite(end) && end >= 1 && end <= 24 ? end : DEFAULT_SEND_WINDOW.endHour;

  return {
    enabled: map["drips.window.enabled"] !== "false",
    // Guard against an inverted window (start >= end) by falling back.
    startHour: startHour < endHour ? startHour : DEFAULT_SEND_WINDOW.startHour,
    endHour: startHour < endHour ? endHour : DEFAULT_SEND_WINDOW.endHour,
    timeZone: tz && validTimeZone(tz) ? tz : DEFAULT_SEND_WINDOW.timeZone,
  };
}
