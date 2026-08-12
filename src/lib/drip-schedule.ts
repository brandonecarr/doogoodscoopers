import prisma from "@/lib/prisma";
import { loadSendWindow, clampToSendWindow } from "@/lib/send-window";

const MINUTE = 60 * 1000;

/**
 * Re-schedule a drip's in-flight recipients after its step delays were edited.
 *
 * For each ACTIVE recipient that has already received a message, the next send is
 * recomputed off their LAST send time using the CURRENT delay of their pending
 * step:  nextSendAt = lastSentAt + newDelay  (clamped to the send window).
 *
 * - If the new interval hasn't elapsed yet, the next send moves to that new time.
 * - If the new (shorter) interval has ALREADY elapsed, nextSendAt lands in the past
 *   and the drip cron picks it up on its next run (respecting quiet hours via the
 *   clamp) — i.e. it goes out promptly instead of on the old, longer schedule.
 * - If the recipient's pending step no longer exists (steps were removed), they're
 *   marked COMPLETED.
 *
 * Idempotent: an unchanged delay reproduces the same schedule, so re-running is safe.
 * Never-sent recipients (still awaiting their first message) are left untouched —
 * they have no "previous message" to measure from.
 *
 * Returns how many recipients were moved/updated.
 */
export async function rescheduleActiveRecipients(campaignId: string): Promise<number> {
  const steps = await prisma.campaignStep.findMany({
    where: { campaignId },
    orderBy: { stepOrder: "asc" },
    select: { delayMinutes: true },
  });
  if (steps.length === 0) return 0;

  const window = await loadSendWindow();
  const recipients = await prisma.campaignRecipient.findMany({
    where: { campaignId, status: "ACTIVE", sentAt: { not: null } },
    select: { id: true, currentStep: true, sentAt: true, nextSendAt: true },
  });

  let moved = 0;
  for (const r of recipients) {
    if (!r.sentAt) continue;

    const step = steps[r.currentStep];
    if (!step) {
      // Their pending step was removed in the edit — nothing left to send.
      await prisma.campaignRecipient.update({
        where: { id: r.id },
        data: { status: "COMPLETED", nextSendAt: null },
      });
      moved++;
      continue;
    }

    const desired = new Date(r.sentAt.getTime() + (step.delayMinutes || 0) * MINUTE);
    const next = clampToSendWindow(desired, window);

    // Only write when it actually shifts (>30s), so unchanged steps don't churn.
    if (!r.nextSendAt || Math.abs(r.nextSendAt.getTime() - next.getTime()) > 30_000) {
      await prisma.campaignRecipient.update({ where: { id: r.id }, data: { nextSendAt: next } });
      moved++;
    }
  }
  return moved;
}
