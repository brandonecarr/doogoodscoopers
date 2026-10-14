import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isQuoConfigured } from "@/lib/quo";
import { sendCampaignText, campaignTextProvider } from "@/lib/text-send";
import { isRelayConfigured, type RelayAllowance } from "@/lib/bluebubbles";
import { renderTemplate } from "@/lib/resend";
import { optedOutKeys, optOutKey } from "@/lib/sms-optout";
import { getLeadPersonalization } from "@/lib/personalization";
import { archiveConvertedLeads, isActiveCustomerByPhone } from "@/lib/lead-duplicates";
import { activeClientPhones, phoneInActiveSet } from "@/lib/sweepandgo-lookup";

// Drains queued campaign recipients and sends via Quo or the iPhone relay. Runs on a cron.
// Batch + spacing keep us well under Quo's 10 req/s limit; the iPhone path is paced
// separately (one send per run, daily cap) so a new number isn't flagged as spam.

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
  if (!isQuoConfigured() && !(await isRelayConfigured())) {
    return NextResponse.json({ success: false, error: "No text provider configured (Quo or iPhone relay)" }, { status: 200 });
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
  let deferred = 0;
  const optedOut = await optedOutKeys();
  const provider = await campaignTextProvider(campaign.channel);
  const allowance: { current: RelayAllowance | null; used: boolean } = { current: null, used: false };

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

    // Already signed up? Don't blast a prospect who's now a Sweep&Go customer.
    // Live check (cached ~60s) with the synced mirror as fallback. Customer-type
    // recipients are exempt.
    if (r.leadType !== "CUSTOMER") {
      const activeSet = await activeClientPhones();
      const signedUp = activeSet ? phoneInActiveSet(activeSet, r.phone) : await isActiveCustomerByPhone(r.phone);
      if (signedUp) {
        await archiveConvertedLeads([r.phone]);
        await prisma.campaignRecipient.update({
          where: { id: r.id },
          data: { status: "SKIPPED", error: "signed up — now a customer", sentAt: new Date() },
        });
        skipped++;
        continue;
      }
    }

    const vars = await getLeadPersonalization(r.leadType, r.leadId, { channel: "sms" });
    // Fall back to the recipient's stored name if the lead record is gone.
    if (!vars.name && r.name) {
      vars.name = r.name;
      vars.firstName = r.name.trim().split(/\s+/)[0] || "";
    }
    const body = renderTemplate(campaign.body, vars);
    const result = await sendCampaignText({ to: r.phone, body, provider, allowance });
    // iPhone pacing says not now: leave the rest of the batch queued for a later run.
    if (result.deferred) { deferred = pending.length - sent - failed - skipped; break; }

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
        provider: result.provider,
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
  if (deferred) console.log(`[campaigns] iPhone pacing: ${deferred} left queued (${allowance.current?.sentToday ?? "?"}/${allowance.current?.cap ?? "?"} today)`);
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
