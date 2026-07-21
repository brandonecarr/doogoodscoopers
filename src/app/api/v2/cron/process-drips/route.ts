import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendSms, isQuoConfigured } from "@/lib/quo";
import { renderTemplate } from "@/lib/resend";
import { optedOutKeys, optOutKey } from "@/lib/sms-optout";
import { findDripCandidates, isLeadArchived } from "@/lib/drip";
import { getLeadPersonalization } from "@/lib/personalization";

// Drives DRIP campaigns: enrolls new matching leads and sends each recipient's
// next step when due. Stops a recipient on reply / opt-out / archive.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SENDS = 60; // per run, keeps us well under Quo's 10 req/s with spacing
const SPACING_MS = 150;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MINUTE = 60 * 1000;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isQuoConfigured()) return NextResponse.json({ success: false, error: "Quo not configured" });

  const campaigns = await prisma.campaign.findMany({
    where: { type: "DRIP", active: true },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

  const optedOut = await optedOutKeys();
  let enrolled = 0;
  let sent = 0;
  let stopped = 0;

  const stop = (id: string, reason: string) =>
    prisma.campaignRecipient.update({ where: { id }, data: { status: "STOPPED", error: reason, nextSendAt: null } });

  for (const campaign of campaigns) {
    const steps = campaign.steps;
    if (steps.length === 0) continue;

    // 1) Enroll new matching leads (step 0 scheduled by its delay; usually now).
    const candidates = await findDripCandidates(campaign);
    for (const c of candidates) {
      try {
        await prisma.campaignRecipient.create({
          data: {
            campaignId: campaign.id,
            leadType: c.leadType,
            leadId: c.leadId,
            phone: c.phone,
            name: c.name,
            status: "ACTIVE",
            currentStep: 0,
            nextSendAt: new Date(Date.now() + (steps[0].delayMinutes || 0) * MINUTE),
          },
        });
        enrolled++;
      } catch {
        // unique(campaignId, leadType, leadId) → already enrolled; skip.
      }
    }

    if (sent >= MAX_SENDS) continue;

    // 2) Send due steps.
    const due = await prisma.campaignRecipient.findMany({
      where: { campaignId: campaign.id, status: "ACTIVE", nextSendAt: { lte: new Date() } },
      take: MAX_SENDS - sent,
    });

    for (const r of due) {
      // Stop conditions.
      if (optedOut.has(optOutKey(r.phone) ?? "")) { await stop(r.id, "opted out"); stopped++; continue; }
      if (await isLeadArchived(r.leadType, r.leadId)) { await stop(r.id, "lead archived"); stopped++; continue; }
      if (campaign.stopOnReply) {
        const replied = await prisma.leadMessage.findFirst({
          where: { leadType: r.leadType, leadId: r.leadId, direction: "INBOUND", createdAt: { gt: r.createdAt } },
          select: { id: true },
        });
        if (replied) { await stop(r.id, "lead replied"); stopped++; continue; }
      }

      const step = steps[r.currentStep];
      if (!step) {
        await prisma.campaignRecipient.update({ where: { id: r.id }, data: { status: "COMPLETED", nextSendAt: null } });
        continue;
      }

      const vars = await getLeadPersonalization(r.leadType, r.leadId);
      // Fall back to the recipient's stored name if the lead record is gone.
      if (!vars.name && r.name) {
        vars.name = r.name;
        vars.firstName = r.name.trim().split(/\s+/)[0] || "";
      }
      const body = renderTemplate(step.body, vars);
      const result = await sendSms({ to: r.phone, body });

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

      const next = steps[r.currentStep + 1];
      await prisma.campaignRecipient.update({
        where: { id: r.id },
        data: {
          currentStep: r.currentStep + 1,
          status: next ? "ACTIVE" : "COMPLETED",
          nextSendAt: next ? new Date(Date.now() + (next.delayMinutes || 0) * MINUTE) : null,
          quoMessageId: result.messageId ?? null,
          sentAt: new Date(),
          error: result.success ? null : result.error ?? "send failed",
        },
      });

      await prisma.campaign.update({
        where: { id: campaign.id },
        data: result.success ? { sentCount: { increment: 1 } } : { failedCount: { increment: 1 } },
      });
      sent++;
      await sleep(SPACING_MS);
      if (sent >= MAX_SENDS) break;
    }

    // Keep the enrolled total fresh for the list view.
    const total = await prisma.campaignRecipient.count({ where: { campaignId: campaign.id } });
    await prisma.campaign.update({ where: { id: campaign.id }, data: { totalRecipients: total } });
  }

  return NextResponse.json({ success: true, campaigns: campaigns.length, enrolled, sent, stopped });
}
