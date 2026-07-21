import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendSms, isQuoConfigured } from "@/lib/quo";
import { renderTemplate } from "@/lib/resend";
import { optedOutKeys, optOutKey } from "@/lib/sms-optout";
import { getLeadPersonalization } from "@/lib/personalization";

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
  let skipped = 0;
  const optedOut = await optedOutKeys();

  for (const r of pending) {
    // Never message a number that replied STOP.
    if (optedOut.has(optOutKey(r.phone) ?? "")) {
      await prisma.campaignRecipient.update({
        where: { id: r.id },
        data: { status: "SKIPPED", error: "opted out (STOP)", sentAt: new Date() },
      });
      skipped++;
      continue;
    }

    const vars = await getLeadPersonalization(r.leadType, r.leadId);
    // Fall back to the recipient's stored name if the lead record is gone.
    if (!vars.name && r.name) {
      vars.name = r.name;
      vars.firstName = r.name.trim().split(/\s+/)[0] || "";
    }
    const body = renderTemplate(campaign.body, vars);
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
    skipped,
    remaining,
    totalSent: updated.sentCount,
  });
}
