import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendSms, isQuoConfigured } from "@/lib/quo";
import { renderTemplate } from "@/lib/resend";

// Drains queued campaign recipients and sends via Quo. Runs on a cron.
// Batch + spacing keep us well under Quo's 10 req/s limit.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 40;
const SPACING_MS = 150; // ~6-7 sends/sec

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isQuoConfigured()) {
    return NextResponse.json({ success: false, error: "Quo not configured" }, { status: 200 });
  }

  // Oldest active campaign first.
  const campaign = await prisma.campaign.findFirst({
    where: { status: { in: ["QUEUED", "SENDING"] } },
    orderBy: { createdAt: "asc" },
  });
  if (!campaign) return NextResponse.json({ success: true, idle: true });

  const pending = await prisma.campaignRecipient.findMany({
    where: { campaignId: campaign.id, status: "PENDING" },
    take: BATCH,
  });

  if (pending.length === 0) {
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "SENT" } });
    return NextResponse.json({ success: true, campaignId: campaign.id, finished: true });
  }

  if (campaign.status !== "SENDING") {
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "SENDING" } });
  }

  let sent = 0;
  let failed = 0;

  for (const r of pending) {
    const firstName = (r.name || "").trim().split(/\s+/)[0] || "";
    const body = renderTemplate(campaign.body, { firstName, name: r.name || "" });
    const result = await sendSms({ to: r.phone, body });

    await prisma.campaignRecipient.update({
      where: { id: r.id },
      data: {
        status: result.success ? "SENT" : "FAILED",
        quoMessageId: result.messageId ?? null,
        error: result.success ? null : result.error ?? "send failed",
        sentAt: new Date(),
      },
    });

    await prisma.leadMessage.create({
      data: {
        leadType: r.leadType,
        leadId: r.leadId,
        direction: "OUTBOUND",
        body,
        phone: r.phone,
        provider: "quo",
        quoMessageId: result.messageId ?? null,
        status: result.success ? result.status || "SENT" : "FAILED",
        adminEmail: campaign.adminEmail,
        campaignId: campaign.id,
      },
    });

    if (result.success) sent++;
    else failed++;
    await sleep(SPACING_MS);
  }

  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { sentCount: { increment: sent }, failedCount: { increment: failed } },
  });

  const remaining = await prisma.campaignRecipient.count({
    where: { campaignId: campaign.id, status: "PENDING" },
  });
  if (remaining === 0) {
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "SENT" } });
  }

  return NextResponse.json({
    success: true,
    campaignId: campaign.id,
    processed: pending.length,
    sent,
    failed,
    remaining,
    totalSent: updated.sentCount,
  });
}
