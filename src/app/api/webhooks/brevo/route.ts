import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { classifyBrevoEvent } from "@/lib/brevo-email";
import { recordUnsubscribe } from "@/lib/email-unsubscribe";

// Brevo transactional event webhook → update per-recipient engagement +
// campaign counters. Configure in Brevo: Transactional → Settings → Webhook,
// pointing at https://<site>/api/webhooks/brevo, with the opened / click /
// hard & soft bounce / unsubscribe / spam events checked.
//
// Payload (per event): { event, email, "message-id", ... }. We match the
// message-id against EmailRecipient.resendId (where the Brevo messageId is
// stored at send time).

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let evt: any;
  try {
    evt = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const event: string | undefined = evt?.event;
  const messageId: string | undefined = evt?.["message-id"] || evt?.messageId;
  if (!event || !messageId) return NextResponse.json({ ok: true });

  const bucket = classifyBrevoEvent(event);
  if (!bucket || bucket === "delivered") return NextResponse.json({ ok: true });

  // Match the stored messageId with or without <angle brackets>.
  const stripped = messageId.replace(/^<|>$/g, "");
  const recipient = await prisma.emailRecipient.findFirst({
    where: { resendId: { in: [messageId, stripped, `<${stripped}>`] } },
    select: { id: true, campaignId: true, email: true, openedAt: true, clickedAt: true, bouncedAt: true },
  });
  if (!recipient) return NextResponse.json({ ok: true });

  const bump = (field: "openCount" | "clickCount" | "bounceCount" | "unsubscribeCount") =>
    prisma.emailCampaign.update({ where: { id: recipient.campaignId }, data: { [field]: { increment: 1 } } });

  if (bucket === "open" && !recipient.openedAt) {
    await prisma.emailRecipient.update({ where: { id: recipient.id }, data: { openedAt: new Date() } });
    await bump("openCount");
  } else if (bucket === "click") {
    // A click implies an open; count the open too if we haven't yet.
    if (!recipient.openedAt) {
      await prisma.emailRecipient.update({ where: { id: recipient.id }, data: { openedAt: new Date() } });
      await bump("openCount");
    }
    if (!recipient.clickedAt) {
      await prisma.emailRecipient.update({ where: { id: recipient.id }, data: { clickedAt: new Date() } });
      await bump("clickCount");
    }
  } else if (bucket === "bounce" && !recipient.bouncedAt) {
    await prisma.emailRecipient.update({ where: { id: recipient.id }, data: { bouncedAt: new Date(), status: "FAILED", error: event } });
    await bump("bounceCount");
  } else if (bucket === "unsub") {
    await recordUnsubscribe(recipient.email, "brevo");
    await bump("unsubscribeCount");
  }

  return NextResponse.json({ ok: true });
}
