import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// ── One person, one Out of Area row ──────────────────────────────────────────
// Sweep&Go has our webhook URL registered several times, so every out-of-area
// quote arrives as ~4 identical deliveries a few hundred ms apart. Moving the
// matching Quote Lead over by hand then added a 5th row. Every path that creates
// an OutOfAreaLead goes through here: it takes a per-person lock (so near-
// simultaneous deliveries can't race past each other) and reuses the existing
// row for that person instead of creating another.

export interface PersonKey {
  email?: string | null;
  phone?: string | null;
}

type Tx = Prisma.TransactionClient;

const last10 = (s?: string | null) => (s ?? "").replace(/\D/g, "").slice(-10);
const normEmail = (s?: string | null) => (s ?? "").trim().toLowerCase();

/** Oldest non-archived OutOfAreaLead with the same email or 10-digit phone, created on/after `since`. */
export async function findOutOfAreaMatch(tx: Tx, who: PersonKey, since: Date = new Date(0)): Promise<string | null> {
  const email = normEmail(who.email);
  const phone = last10(who.phone);
  const hasPhone = phone.length === 10;
  if (!email && !hasPhone) return null;
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "OutOfAreaLead"
    WHERE archived = false
      AND "createdAt" >= ${since}
      AND (
        (${email} <> '' AND lower(trim(email)) = ${email})
        OR (${hasPhone} AND right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = ${phone})
      )
    ORDER BY "createdAt" ASC
    LIMIT 1`;
  return rows[0]?.id ?? null;
}

/** Run `fn` in a transaction holding a lock for this person, so duplicate deliveries are serialized. */
export async function withOutOfAreaLock<T>(who: PersonKey, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const key = `ooa:${normEmail(who.email) || last10(who.phone) || "unknown"}`;
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(hashtext(${key}))) AS l`;
      return fn(tx);
    },
    { timeout: 15000, maxWait: 10000 },
  );
}
