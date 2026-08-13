import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendCampaignBatch, isEmailConfigured } from "@/lib/email-send";
import { unsubscribedSet, normalizeEmail } from "@/lib/email-unsubscribe";
import { activeClientEmails, emailInActiveSet } from "@/lib/sweepandgo-lookup";

// Drains queued email campaigns and sends via Resend in batches. Runs on a cron.

// Contact types that are PROSPECTS — subject to the "already signed up?" check.
// customer / contact are intentionally targeted (e.g. newsletters) and exempt.
const PROSPECT_EMAIL_TYPES = new Set(["quote", "ad", "outofarea", "commercial", "career"]);

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PER_RUN = 100; // emails per run
const BATCH = 50; // Resend batch size
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isEmailConfigured()) return NextResponse.json({ success: false, error: "Resend not configured" });

  // Promote due scheduled campaigns.
  await prisma.emailCampaign.updateMany({ where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } }, data: { status: "QUEUED" } });

  const campaign = await prisma.emailCampaign.findFirst({ where: { status: { in: ["QUEUED", "SENDING"] } }, orderBy: { createdAt: "asc" } });
  if (!campaign) return NextResponse.json({ success: true, idle: true });

  const pending = await prisma.emailRecipient.findMany({ where: { campaignId: campaign.id, status: "PENDING" }, take: PER_RUN });
  if (pending.length === 0) {
    await prisma.emailCampaign.update({ where: { id: campaign.id }, data: { status: "SENT" } });
    return NextResponse.json({ success: true, campaignId: campaign.id, finished: true });
  }
  if (campaign.status !== "SENDING") {
    await prisma.emailCampaign.update({ where: { id: campaign.id }, data: { status: "SENDING" } });
  }

  const unsub = await unsubscribedSet();
  let sent = 0, failed = 0, skipped = 0;

  // Active Sweep&Go clients (by email) so a prospect broadcast never reaches
  // someone who already signed up. Live list first; fall back to the synced mirror
  // if Sweep&Go is unreachable so the broadcast still respects conversions.
  let activeEmails = await activeClientEmails();
  if (!activeEmails) {
    const rows = await prisma.sweepandgoCustomer.findMany({ where: { active: true, email: { not: null } }, select: { email: true } });
    activeEmails = new Set(rows.map((r) => (r.email || "").trim().toLowerCase()).filter(Boolean));
  }

  for (let i = 0; i < pending.length; i += BATCH) {
    const slice = pending.slice(i, i + BATCH);
    const toSend: typeof slice = [];
    for (const r of slice) {
      if (unsub.has(normalizeEmail(r.email))) {
        await prisma.emailRecipient.update({ where: { id: r.id }, data: { status: "SKIPPED", error: "unsubscribed", sentAt: new Date() } });
        skipped++;
      } else if (r.contactType && PROSPECT_EMAIL_TYPES.has(r.contactType) && emailInActiveSet(activeEmails, r.email)) {
        // Prospect who already signed up — don't send them a prospect broadcast.
        await prisma.emailRecipient.update({ where: { id: r.id }, data: { status: "SKIPPED", error: "signed up — now a customer", sentAt: new Date() } });
        skipped++;
      } else {
        toSend.push(r);
      }
    }
    if (toSend.length === 0) continue;

    const results = await sendCampaignBatch({
      subject: campaign.subject,
      html: campaign.html,
      from: { fromName: campaign.fromName, fromEmail: campaign.fromEmail, replyTo: campaign.replyTo },
      recipients: toSend.map((r) => ({ id: r.id, email: r.email, name: r.name })),
    });
    for (const res of results) {
      if (res.resendId) {
        await prisma.emailRecipient.update({ where: { id: res.id }, data: { status: "SENT", resendId: res.resendId, sentAt: new Date() } });
        sent++;
      } else {
        await prisma.emailRecipient.update({ where: { id: res.id }, data: { status: "FAILED", error: res.error, sentAt: new Date() } });
        failed++;
      }
    }
    await sleep(400);
  }

  await prisma.emailCampaign.update({ where: { id: campaign.id }, data: { sentCount: { increment: sent }, failedCount: { increment: failed } } });

  const remaining = await prisma.emailRecipient.count({ where: { campaignId: campaign.id, status: "PENDING" } });
  if (remaining === 0) await prisma.emailCampaign.update({ where: { id: campaign.id }, data: { status: "SENT" } });

  return NextResponse.json({ success: true, campaignId: campaign.id, sent, failed, skipped, remaining });
}
