import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { fetchBrevoEvents, classifyBrevoEvent, isBrevoConfigured, mapLimit } from "@/lib/brevo-email";
import { recordUnsubscribe } from "@/lib/email-unsubscribe";

// POST → back-fill engagement stats for an already-sent campaign by pulling each
// recipient's transactional events from Brevo. Idempotent: recomputes the
// campaign's open/click/bounce/unsubscribe counts from scratch each run.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isBrevoConfigured()) return NextResponse.json({ error: "Brevo is not configured." }, { status: 400 });

  const { id } = await params;
  const campaign = await prisma.emailCampaign.findUnique({ where: { id }, select: { id: true } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  // Only recipients we actually handed to Brevo carry a messageId to look up.
  const recipients = await prisma.emailRecipient.findMany({
    where: { campaignId: id, resendId: { not: null } },
    select: { id: true, email: true, resendId: true },
    take: 2000,
  });

  let unsubCount = 0;

  await mapLimit(recipients, 6, async (r) => {
    const events = await fetchBrevoEvents(r.resendId!);
    if (events.length === 0) return;

    let opened = false, clicked = false, bounced = false, unsub = false;
    for (const e of events) {
      const bucket = classifyBrevoEvent(e.event);
      if (bucket === "open") opened = true;
      else if (bucket === "click") { clicked = true; opened = true; }
      else if (bucket === "bounce") bounced = true;
      else if (bucket === "unsub") unsub = true;
    }

    await prisma.emailRecipient.update({
      where: { id: r.id },
      data: {
        openedAt: opened ? new Date() : null,
        clickedAt: clicked ? new Date() : null,
        bouncedAt: bounced ? new Date() : null,
        ...(bounced ? { status: "FAILED", error: "bounced" } : {}),
      },
    });

    if (unsub) {
      unsubCount++;
      await recordUnsubscribe(r.email, "brevo").catch(() => {});
    }
  });

  // Recompute campaign counters from the freshly-updated recipient rows.
  const [openCount, clickCount, bounceCount] = await Promise.all([
    prisma.emailRecipient.count({ where: { campaignId: id, openedAt: { not: null } } }),
    prisma.emailRecipient.count({ where: { campaignId: id, clickedAt: { not: null } } }),
    prisma.emailRecipient.count({ where: { campaignId: id, bouncedAt: { not: null } } }),
  ]);

  await prisma.emailCampaign.update({
    where: { id },
    data: { openCount, clickCount, bounceCount, unsubscribeCount: unsubCount },
  });

  return NextResponse.json({ success: true, checked: recipients.length, openCount, clickCount, bounceCount, unsubscribeCount: unsubCount });
}
