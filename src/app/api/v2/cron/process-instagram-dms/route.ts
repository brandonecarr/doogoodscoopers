import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isInstagramConfigured, sendPrivateReply, replyToComment } from "@/lib/instagram";
import { notify } from "@/lib/notify";

// Drains queued Instagram auto-DMs and sends them as private replies, rate-limited
// well under Meta's ~750/hour cap. Runs on a cron every minute.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PER_RUN = 40;
const SPACING_MS = 250;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isInstagramConfigured()) return NextResponse.json({ success: false, error: "Instagram not configured" });

  const queue = await prisma.instagramDm.findMany({
    where: { status: { in: ["QUEUED", "RATE_LIMITED"] } },
    orderBy: { createdAt: "asc" },
    take: PER_RUN,
  });
  if (queue.length === 0) return NextResponse.json({ success: true, idle: true });

  // Look up each campaign's optional public-reply text once for the batch.
  const campaignIds = [...new Set(queue.map((q) => q.campaignId))];
  const campaigns = await prisma.instagramCampaign.findMany({
    where: { id: { in: campaignIds } },
    select: { id: true, publicReply: true },
  });
  const publicReplyByCampaign = new Map(campaigns.map((c) => [c.id, c.publicReply]));

  let sent = 0, failed = 0, rateLimited = 0;

  for (const dm of queue) {
    const res = await sendPrivateReply(dm.commentId, dm.text);

    if (res.ok) {
      await prisma.instagramDm.update({ where: { id: dm.id }, data: { status: "SENT", sentAt: new Date(), error: null } });
      await prisma.instagramCampaign.update({ where: { id: dm.campaignId }, data: { sentCount: { increment: 1 } } });
      sent++;
      // Optional public comment reply.
      const pub = publicReplyByCampaign.get(dm.campaignId);
      if (pub) await replyToComment(dm.commentId, pub).catch(() => {});
    } else if (res.rateLimited) {
      // Leave it for the next run; stop sending this minute to respect the limit.
      await prisma.instagramDm.update({ where: { id: dm.id }, data: { status: "RATE_LIMITED", error: res.error } });
      rateLimited++;
      break;
    } else {
      await prisma.instagramDm.update({ where: { id: dm.id }, data: { status: "FAILED", error: res.error } });
      await prisma.instagramCampaign.update({ where: { id: dm.campaignId }, data: { failedCount: { increment: 1 } } });
      failed++;
    }

    await sleep(SPACING_MS);
  }

  // Surface a persistent alert if Meta is rate-limiting us hard.
  if (rateLimited > 0) {
    await notify({
      type: "system",
      severity: "warning",
      title: "Instagram is rate-limiting auto-DMs",
      body: "Some auto-DMs were deferred to stay under Meta's limit. They'll keep retrying automatically.",
      link: "/admin/instagram",
      dedupeKey: "ig:rate-limited",
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, sent, failed, rateLimited, processed: queue.length });
}
