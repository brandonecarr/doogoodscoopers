import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendCampaignBatch, isEmailConfigured } from "@/lib/email-send";
import { unsubscribedSet, normalizeEmail } from "@/lib/email-unsubscribe";
import { findAutomationCandidates } from "@/lib/email-automation";

// Drives email automations: enrolls new matching contacts and sends each
// recipient's next step when due. Stops on unsubscribe.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SENDS = 50;
const MINUTE = 60 * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isEmailConfigured()) return NextResponse.json({ success: false, error: "Resend not configured" });

  const automations = await prisma.emailAutomation.findMany({ where: { active: true } });
  const unsub = await unsubscribedSet();
  const templateCache = new Map<string, string>();
  const getTemplateHtml = async (id: string): Promise<string> => {
    if (templateCache.has(id)) return templateCache.get(id)!;
    const t = await prisma.emailTemplate.findUnique({ where: { id }, select: { html: true } });
    const html = t?.html || "";
    templateCache.set(id, html);
    return html;
  };

  let enrolled = 0, sent = 0, stopped = 0;

  for (const a of automations) {
    const steps = await prisma.emailAutomationStep.findMany({ where: { automationId: a.id }, orderBy: { stepOrder: "asc" } });
    if (steps.length === 0) continue;

    // 1) Enroll new candidates.
    for (const c of await findAutomationCandidates(a)) {
      try {
        await prisma.emailAutomationRecipient.create({
          data: { automationId: a.id, contactType: c.contactType, contactId: c.contactId, email: c.email, name: c.name, status: "ACTIVE", currentStep: 0, nextSendAt: new Date(Date.now() + (steps[0].delayMinutes || 0) * MINUTE) },
        });
        enrolled++;
      } catch { /* already enrolled */ }
    }

    if (sent >= MAX_SENDS) continue;

    // 2) Send due steps.
    const due = await prisma.emailAutomationRecipient.findMany({ where: { automationId: a.id, status: "ACTIVE", nextSendAt: { lte: new Date() } }, take: MAX_SENDS - sent });
    for (const r of due) {
      if (unsub.has(normalizeEmail(r.email))) {
        await prisma.emailAutomationRecipient.update({ where: { id: r.id }, data: { status: "STOPPED", error: "unsubscribed", nextSendAt: null } });
        stopped++;
        continue;
      }
      const step = steps[r.currentStep];
      if (!step) { await prisma.emailAutomationRecipient.update({ where: { id: r.id }, data: { status: "COMPLETED", nextSendAt: null } }); continue; }

      let html = step.html || "";
      if (step.templateId) html = (await getTemplateHtml(step.templateId)) || html;
      if (!html) { // nothing to send — advance so we don't loop forever
        const next = steps[r.currentStep + 1];
        await prisma.emailAutomationRecipient.update({ where: { id: r.id }, data: { currentStep: r.currentStep + 1, status: next ? "ACTIVE" : "COMPLETED", nextSendAt: next ? new Date(Date.now() + (next.delayMinutes || 0) * MINUTE) : null } });
        continue;
      }

      const [res] = await sendCampaignBatch({ subject: step.subject, html, from: {}, recipients: [{ id: r.id, email: r.email, name: r.name }] });
      const next = steps[r.currentStep + 1];
      await prisma.emailAutomationRecipient.update({
        where: { id: r.id },
        data: { currentStep: r.currentStep + 1, status: next ? "ACTIVE" : "COMPLETED", nextSendAt: next ? new Date(Date.now() + (next.delayMinutes || 0) * MINUTE) : null, sentAt: new Date(), error: res.resendId ? null : res.error },
      });
      if (res.resendId) { sent++; await prisma.emailAutomation.update({ where: { id: a.id }, data: { sentCount: { increment: 1 } } }); }
      await sleep(300);
      if (sent >= MAX_SENDS) break;
    }
  }

  return NextResponse.json({ success: true, automations: automations.length, enrolled, sent, stopped });
}
