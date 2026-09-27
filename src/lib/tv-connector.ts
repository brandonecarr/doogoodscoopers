// ─── OfficeTV connector ───────────────────────────────────────────────────────
// The Apple TV "Growth Board" calls /api/tv/* with `Authorization: Bearer <key>`.
// Keys are generated in Settings → OfficeTV; only their sha256 hash is stored.

import { createHash, randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { fromDateInputValue, toDateInputValue } from "@/lib/datetime";

const KEY_PREFIX = "dgstv_";

export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** A new random key. The raw value is returned once; store only `hashKey(raw)`. */
export function generateKey(): string {
  return KEY_PREFIX + randomBytes(24).toString("base64url");
}

/** Checks the bearer key; records when it was last used. Returns the key id, or null. */
export async function authenticateTv(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  const raw = header.slice(7).trim();
  if (!raw.startsWith(KEY_PREFIX)) return null;

  const key = await prisma.tvConnectorKey.findUnique({ where: { keyHash: hashKey(raw) } });
  if (!key || key.revokedAt) return null;

  // Throttle the write: once a minute is plenty for "last used".
  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000) {
    await prisma.tvConnectorKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }
  return key.id;
}

// ─── Business-day math (America/Los_Angeles) ──────────────────────────────────
// Day keys are "YYYY-MM-DD" in the business timezone; instants come from datetime.ts.

export function businessDay(date: Date = new Date()): string {
  return toDateInputValue(date);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Midnight at the start of a business day, as a UTC instant. */
export function dayStart(day: string): Date {
  return new Date(fromDateInputValue(day)!);
}

/** Monday of the business week containing `day`. */
export function weekStartDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

/** "Mon 28" for a business day key. */
export function shortDayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return `${t.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })} ${d}`;
}

/** "Alex R." — the TV is visible to visitors, so never full names. */
export function privateName(first?: string | null, last?: string | null, fallback = "Lead"): string {
  // Some forms put the whole name in the first-name field ("Valerie Carr"); split it.
  const parts = `${first || ""} ${last || ""}`.trim().split(/\s+/).filter(Boolean);
  const f = parts[0] || "";
  const l = parts.length > 1 ? parts[parts.length - 1] : "";
  if (!f && !l) return fallback;
  if (!f) return `${l[0].toUpperCase()}.`;
  return l ? `${f} ${l[0].toUpperCase()}.` : f;
}
