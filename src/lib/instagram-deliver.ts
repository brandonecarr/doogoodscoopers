import prisma from "@/lib/prisma";
import { sendPrivateReply, replyToComment } from "@/lib/instagram";

export type DeliverResult = { ok: boolean; rateLimited?: boolean; failed?: boolean };

/**
 * Send one queued Instagram DM as a private reply, then reconcile its row and
 * the campaign counters. Optionally posts the campaign's public comment reply.
 *
 * Shared by the webhook (inline, for ~instant delivery) and the cron (backstop
 * for anything that wasn't delivered inline or got rate-limited).
 */
export async function deliverInstagramDm(
  dm: { id: string; commentId: string; text: string; campaignId: string },
  publicReply?: string | null,
): Promise<DeliverResult> {
  const res = await sendPrivateReply(dm.commentId, dm.text);

  if (res.ok) {
    await prisma.instagramDm.update({
      where: { id: dm.id },
      data: { status: "SENT", sentAt: new Date(), error: null },
    });
    await prisma.instagramCampaign.update({
      where: { id: dm.campaignId },
      data: { sentCount: { increment: 1 } },
    });
    if (publicReply) await replyToComment(dm.commentId, publicReply).catch(() => {});
    return { ok: true };
  }

  if (res.rateLimited) {
    await prisma.instagramDm.update({
      where: { id: dm.id },
      data: { status: "RATE_LIMITED", error: res.error },
    });
    return { ok: false, rateLimited: true };
  }

  await prisma.instagramDm.update({
    where: { id: dm.id },
    data: { status: "FAILED", error: res.error },
  });
  await prisma.instagramCampaign.update({
    where: { id: dm.campaignId },
    data: { failedCount: { increment: 1 } },
  });
  return { ok: false, failed: true };
}
