import crypto from "crypto";
import prisma from "@/lib/prisma";

// Email suppression (CAN-SPAM). Signed unsubscribe tokens so links can't be forged.

const SECRET = process.env.EMAIL_UNSUB_SECRET || process.env.CRON_SECRET || "dgs-email-unsub";

export function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}

export function unsubToken(email: string): string {
  const e = normalizeEmail(email);
  const b = Buffer.from(e).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(e).digest("base64url").slice(0, 16);
  return `${b}.${sig}`;
}

export function verifyUnsubToken(token: string): string | null {
  const [b, sig] = (token || "").split(".");
  if (!b || !sig) return null;
  let email: string;
  try { email = Buffer.from(b, "base64url").toString("utf8"); } catch { return null; }
  const expected = crypto.createHmac("sha256", SECRET).update(email).digest("base64url").slice(0, 16);
  return sig === expected ? email : null;
}

export async function isUnsubscribed(email: string): Promise<boolean> {
  return !!(await prisma.emailUnsubscribe.findUnique({ where: { email: normalizeEmail(email) }, select: { id: true } }));
}

export async function recordUnsubscribe(email: string, reason = "unsubscribe"): Promise<void> {
  const e = normalizeEmail(email);
  await prisma.emailUnsubscribe.upsert({ where: { email: e }, create: { email: e, reason }, update: {} });
  await prisma.emailContact.updateMany({ where: { email: e }, data: { status: "UNSUBSCRIBED" } });
}

export async function unsubscribedSet(): Promise<Set<string>> {
  const rows = await prisma.emailUnsubscribe.findMany({ select: { email: true } });
  return new Set(rows.map((r) => r.email));
}
