import prisma from "@/lib/prisma";

/**
 * SMS opt-out (do-not-contact) list. When a lead replies STOP (or a similar
 * carrier opt-out keyword) we archive them and add their phone here so no
 * outbound — one-off or campaign — ever goes to that number again.
 */

const OPT_OUT_KEYWORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPTOUT", "OPT-OUT", "REVOKE"]);

/** Last-10 digits — the stable key used everywhere for opt-out matching. */
export function optOutKey(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/** True if a message body is an opt-out keyword (first word, case-insensitive). */
export function isOptOutMessage(body: string | null | undefined): boolean {
  if (!body) return false;
  const first = body.trim().toUpperCase().split(/\s+/)[0]?.replace(/[.!,]/g, "");
  return !!first && OPT_OUT_KEYWORDS.has(first);
}

export async function isOptedOut(phone: string | null | undefined): Promise<boolean> {
  const key = optOutKey(phone);
  if (!key) return false;
  const row = await prisma.smsOptOut.findUnique({ where: { phone: key } });
  return !!row;
}

export async function recordOptOut(phone: string | null | undefined, keyword?: string): Promise<void> {
  const key = optOutKey(phone);
  if (!key) return;
  await prisma.smsOptOut.upsert({
    where: { phone: key },
    update: { keyword: keyword ?? undefined },
    create: { phone: key, keyword: keyword ?? null },
  });
}

/** All opted-out keys — for filtering campaign recipients in bulk. */
export async function optedOutKeys(): Promise<Set<string>> {
  const rows = await prisma.smsOptOut.findMany({ select: { phone: true } });
  return new Set(rows.map((r) => r.phone));
}
