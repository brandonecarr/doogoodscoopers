import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isInstagramConfigured } from "@/lib/instagram";
import { deliverInstagramDm } from "@/lib/instagram-deliver";
import { notify } from "@/lib/notify";

// Backstop for Instagram auto-DMs. The webhook delivers matches inline (~1s); this
// cron only picks up stragglers the webhook didn't send — crashes, and rows left
// RATE_LIMITED — so we skip anything younger than the inline window. Rate-limited
// well under Meta's ~750/hour cap. Runs every minute.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PER_RUN = 40;
const SPACING_MS = 250;
// Give the webhook's inline send time to resolve a fresh row before the cron
// also grabs it (prevents a double-send without needing a transient lock state).
const INLINE_GRACE_MS = 30_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isInstagramConfigured()) return NextResponse.json({ success: false, error: "Instagram not configured" });

  const queue = await prisma.instagramDm.findMany({
    where: {
      status: { in: ["QUEUED", "RATE_LIMITED"] },
      createdAt: { lt: new Date(Date.now() - INLINE_GRACE_MS) },
    },
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
    const res = await deliverInstagramDm(dm, publicReplyByCampaign.get(dm.campaignId) ?? null);

    if (res.ok) {
      sent++;
    } else if (res.rateLimited) {
      // Row is already marked RATE_LIMITED; stop this minute to respect the limit.
      rateLimited++;
      break;
    } else {
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
