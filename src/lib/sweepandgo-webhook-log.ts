import { createHash } from "crypto";
import prisma from "@/lib/prisma";

// ── Sweep&Go webhook recorder ────────────────────────────────────────────────
// Step 1 of replacing Sweep&Go polling with webhooks: store every delivery as it
// arrives, before we build anything on top of it. Answers: which events does
// Sweep&Go actually send us, what's in them, how late do they arrive (receivedAt
// vs Sweep&Go's createdAt), and how often is the same event delivered twice
// (Sweep&Go has several tokens pointing at our URL). Never throws.

const RETENTION_DAYS = 90;

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function recordWebhookEvent(input: {
  body: Record<string, unknown>;
  type: string;
  data: Record<string, unknown>;
  secretMatched: boolean | null;
  authSeen: Record<string, boolean>;
}): Promise<void> {
  try {
    const { body, type, data } = input;
    const dedupKey = createHash("sha256").update(`${type}|${JSON.stringify(data ?? null)}`).digest("hex");
    await prisma.sngWebhookEvent.create({
      data: {
        type,
        sngEventId: typeof body.id === "string" || typeof body.id === "number" ? String(body.id) : null,
        sngCreatedAt: parseDate(body.created_at),
        clientId: typeof data?.client === "string" ? data.client : null,
        dedupKey,
        secretMatched: input.secretMatched,
        authSeen: input.authSeen,
        payload: JSON.parse(JSON.stringify(body)),
      },
    });
    // Cheap self-pruning instead of another cron.
    if (Math.random() < 0.02) {
      await prisma.sngWebhookEvent.deleteMany({
        where: { receivedAt: { lt: new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000) } },
      });
    }
  } catch (e) {
    console.error("[SweepAndGo] could not record webhook event:", e instanceof Error ? e.message : e);
  }
}
