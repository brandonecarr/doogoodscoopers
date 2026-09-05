import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendSms, isQuoConfigured } from "@/lib/quo";
import { renderTemplate, sendEmail, wrapEmailHtml } from "@/lib/resend";
import { sendMessengerMessage, isMessengerConfigured } from "@/lib/messenger";
import { optedOutKeys, optOutKey } from "@/lib/sms-optout";
import { findDripCandidates, isLeadArchived, markLeadContactedIfNew } from "@/lib/drip";
import { getLeadPersonalization } from "@/lib/personalization";
import { loadSendWindow, clampToSendWindow, isWithinSendWindow } from "@/lib/send-window";
import { notify } from "@/lib/notify";
import { archiveConvertedLeads, isActiveCustomerByPhone } from "@/lib/lead-duplicates";
import { activeClientPhones, phoneInActiveSet } from "@/lib/sweepandgo-lookup";

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
  const sendWindow = await loadSendWindow();
  // Global {{reviewLink}} token for review-request drips (the Google "leave a review" link).
  const reviewLink = (await prisma.appSetting.findUnique({ where: { key: "reviews.google.writeUrl" } }))?.value || "";
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
            nextSendAt: clampToSendWindow(new Date(Date.now() + (steps[0].delayMinutes || 0) * MINUTE), sendWindow),
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

      // Already signed up? Ping Sweep&Go (live active-client list, cached ~60s)
      // right before texting a prospect — never message someone who's already a
      // customer. This closes the gap between signup and the hourly convert-sync.
      // Falls back to the synced mirror if Sweep&Go is unreachable, so an outage
      // never blocks sends. Skipped for CUSTOMER drips (those ARE customers).
      if (r.leadType !== "CUSTOMER") {
        const activeSet = await activeClientPhones();
        const signedUp = activeSet
          ? phoneInActiveSet(activeSet, r.phone)
          : await isActiveCustomerByPhone(r.phone);
        if (signedUp) {
          await archiveConvertedLeads([r.phone]);
          await stop(r.id, "signed up — now a Sweep&Go customer");
          stopped++;
          continue;
        }
      }

      const step = steps[r.currentStep];
      if (!step) {
        await prisma.campaignRecipient.update({ where: { id: r.id }, data: { status: "COMPLETED", nextSendAt: null } });
        continue;
      }

      // Never ask for a review from a customer who already left one. Catches reviews
      // marked complete by the Google sync OR by hand, even mid-sequence. Only gates
      // review-ask steps ({{reviewLink}}) so other drips are unaffected.
      if (r.leadType === "CUSTOMER" && step.body.includes("{{reviewLink}}")) {
        const c = await prisma.sweepandgoCustomer.findUnique({ where: { id: r.leadId }, select: { reviewStatus: true } });
        if (c?.reviewStatus === "REVIEW_COMPLETE") { await stop(r.id, "customer left a review"); stopped++; continue; }
      }

      // Quiet hours: don't text in the middle of the night. If this send came
      // due outside the window, push it to the next window open and skip for now.
      if (!isWithinSendWindow(new Date(), sendWindow)) {
        await prisma.campaignRecipient.update({ where: { id: r.id }, data: { nextSendAt: clampToSendWindow(new Date(), sendWindow) } });
        continue;
      }

      const vars = await getLeadPersonalization(r.leadType, r.leadId);
      // Fall back to the recipient's stored name if the lead record is gone.
      if (!vars.name && r.name) {
        vars.name = r.name;
        vars.firstName = r.name.trim().split(/\s+/)[0] || "";
      }
      const body = renderTemplate(step.body, { ...vars, reviewLink });

      // ── Channel dispatch ──────────────────────────────────────────────────
      // A "messenger" drip goes to Facebook Messenger when the lead has a linked
      // thread and the window is still open; otherwise it falls back to SMS, then
      // email. Every other campaign sends SMS exactly as before.
      let provider = "quo";
      let result: { success: boolean; messageId?: string | null; status?: string; error?: string } | null = null;
      if (campaign.channel === "messenger" && r.leadType === "AD_LEAD") {
        const ad = await prisma.adLead.findUnique({
          where: { id: r.leadId },
          select: { messengerPsid: true, messengerLastInboundAt: true, email: true },
        });
        const psid = ad?.messengerPsid || null;
        // 7-day human-agent window (the RESPONSE type covers the first 24h).
        const windowOpen = ad?.messengerLastInboundAt ? Date.now() - ad.messengerLastInboundAt.getTime() < 7 * 24 * 60 * 60 * 1000 : false;

        // Try Messenger first — but only keep it if it actually sent. A failed
        // Messenger send falls through to the SMS/email fallback below.
        if (psid && windowOpen && (await isMessengerConfigured())) {
          const m = await sendMessengerMessage({ psid, text: body });
          if (m.ok) { provider = "messenger"; result = { success: true, messageId: m.messageId ?? null, status: "SENT" }; }
        }
        // Fallback chain: SMS → email (covers no-thread, closed-window, AND a
        // Messenger send that errored).
        if (!result) {
          if (r.phone && isQuoConfigured()) {
            provider = "quo";
            result = await sendSms({ to: r.phone, body });
          } else if (ad?.email) {
            const safe = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const e = await sendEmail({ to: ad.email, subject: "A quick note from DooGoodScoopers", text: body, html: wrapEmailHtml(`<p>${safe}</p>`) });
            provider = "email";
            result = { success: e.success, messageId: e.messageId ?? null, status: e.success ? "SENT" : "FAILED", error: e.error };
          } else {
            provider = "none";
            result = { success: false, error: "no channel available (no messenger/phone/email)" };
          }
        }
      } else {
        provider = "quo";
        result = await sendSms({ to: r.phone, body });
      }
      if (!result) { provider = "none"; result = { success: false, error: "no send path" }; }

      await prisma.leadMessage.create({
        data: {
          leadType: r.leadType,
          leadId: r.leadId,
          direction: "OUTBOUND",
          body,
          phone: r.phone,
          provider,
          quoMessageId: provider === "quo" ? (result.messageId ?? null) : null,
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
          nextSendAt: next ? clampToSendWindow(new Date(Date.now() + (next.delayMinutes || 0) * MINUTE), sendWindow) : null,
          quoMessageId: result.messageId ?? null,
          sentAt: new Date(),
          error: result.success ? null : result.error ?? "send failed",
        },
      });

      await prisma.campaign.update({
        where: { id: campaign.id },
        data: result.success ? { sentCount: { increment: 1 } } : { failedCount: { increment: 1 } },
      });

      // A send that fails needs to reach the owner. Out-of-credits in particular
      // fails every message silently, so it dedupes to a single standing alert.
      if (!result.success) {
        const err = result.error || "unknown error";
        const outOfCredits = /credit/i.test(err);
        await notify({
          type: outOfCredits ? "credits" : "delivery_failed",
          severity: "error",
          title: outOfCredits ? "Quo is out of messaging credits" : `Couldn't send a text to ${r.name || r.phone}`,
          body: outOfCredits
            ? "Drip messages are failing to send. Add credits in Quo to resume."
            : `${r.phone}: ${err}`,
          link: `/admin/campaigns/${campaign.id}`,
          dedupeKey: outOfCredits ? "quo:no-credits" : undefined,
          push: outOfCredits,
        });
      }

      // First successful drip contact moves a NEW lead → Contacted (won't
      // overwrite a status you've set by hand). Idempotent on later steps.
      if (result.success) await markLeadContactedIfNew(r.leadType, r.leadId);

      // Review request → track it in the Reviews section. Only when we actually
      // sent a review-ask (the step uses {{reviewLink}}) to a customer. Idempotent
      // per customer so re-sends / later steps don't reset a manually-set status.
      if (result.success && r.leadType === "CUSTOMER" && step.body.includes("{{reviewLink}}")) {
        await prisma.review.upsert({
          where: { externalId: `reviewreq:${r.leadId}` },
          create: {
            externalId: `reviewreq:${r.leadId}`,
            customerName: r.name || vars.name || "Customer",
            phone: r.phone,
            sngCustomerId: r.leadId,
            platform: "google",
            status: "REQUESTED",
            requestChannel: "sms",
            requestedAt: new Date(),
          },
          update: {},
        }).catch((e) => console.error("[process-drips] review upsert failed", e));

        // Reflect it on the customer's review status (Customers section). Gated
        // on NO_REVIEW so a manual "Review Complete" is never overwritten.
        await prisma.sweepandgoCustomer.updateMany({
          where: { id: r.leadId, reviewStatus: "NO_REVIEW" },
          data: { reviewStatus: "REQUEST_SENT" },
        }).catch((e) => console.error("[process-drips] review status update failed", e));
      }
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
