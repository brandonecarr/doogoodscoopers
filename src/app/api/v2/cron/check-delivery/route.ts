import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { quoFetch, isQuoConfigured } from "@/lib/quo";
import { notify } from "@/lib/notify";

/**
 * Delivery-status poller.
 *
 * Quo only offers `message.received` and `message.delivered` webhooks — there is
 * NO failure event to subscribe to (verified against their API). So a message
 * the carrier rejects is accepted by Quo, given an id, and then silently marked
 * "undelivered" with nothing pushed to us. Without this poller a drip keeps
 * marching through its steps to a number that can't receive texts, and the UI
 * reports the sends as successful.
 *
 * Each run re-checks recent outbound messages that aren't in a final state,
 * writes the real status back, and on a hard failure stops that lead's drip and
 * raises a notification.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FINAL = ["DELIVERED", "FAILED", "UNDELIVERED"];
const MAX_CHECKS = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isQuoConfigured()) return NextResponse.json({ success: false, error: "Quo not configured" });

  // Anything sent in the last 2 days that hasn't reached a final state yet.
  const pending = await prisma.leadMessage.findMany({
    where: {
      direction: "OUTBOUND",
      quoMessageId: { not: null },
      createdAt: { gt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      NOT: { status: { in: FINAL } },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_CHECKS,
  });

  let checked = 0, updated = 0, failed = 0, stopped = 0;

  for (const m of pending) {
    if (!m.quoMessageId) continue;
    checked++;
    const res = await quoFetch(`/messages/${encodeURIComponent(m.quoMessageId)}`);
    if (!res.ok) continue;
    const raw = String((res.data as { data?: { status?: string } })?.data?.status || "").toLowerCase();
    if (!raw) continue;

    // "undelivered" is Quo's carrier-rejection state; treat it as a hard failure.
    const isFailure = /undeliver|fail|error|reject/.test(raw);
    const status = isFailure ? "FAILED" : raw === "delivered" ? "DELIVERED" : raw.toUpperCase();
    if (status === m.status) continue;

    await prisma.leadMessage.update({ where: { id: m.id }, data: { status } });
    updated++;
    if (!isFailure) continue;
    failed++;

    // A number that can't receive texts should not keep receiving drip steps.
    const active = await prisma.campaignRecipient.findMany({
      where: { leadType: m.leadType, leadId: m.leadId, status: "ACTIVE" },
      select: { id: true, campaignId: true, name: true },
    });
    const dripIds = new Set(
      (await prisma.campaign.findMany({
        where: { id: { in: active.map((a) => a.campaignId) }, type: "DRIP" },
        select: { id: true },
      })).map((c) => c.id)
    );
    const toStop = active.filter((a) => dripIds.has(a.campaignId));
    if (toStop.length) {
      await prisma.campaignRecipient.updateMany({
        where: { id: { in: toStop.map((t) => t.id) } },
        data: { status: "STOPPED", error: `undeliverable (${raw})`, nextSendAt: null },
      });
      stopped += toStop.length;
    }

    const who = toStop[0]?.name || m.phone;
    await notify({
      type: "delivery_failed",
      severity: "warning",
      title: `Couldn't deliver a text to ${who}`,
      body:
        `The carrier returned "${raw}" for ${m.phone}.` +
        (toStop.length ? " They've been removed from the drip campaign." : ""),
      link: "/admin/campaigns",
      dedupeKey: `delivery_failed:${m.id}`,
    });
  }

  return NextResponse.json({ success: true, checked, updated, failed, stopped });
}
