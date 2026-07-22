import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import prisma from "@/lib/prisma";
import { recordUnsubscribe } from "@/lib/email-unsubscribe";

// Resend event webhook → update per-recipient engagement + campaign counters.
// Events: email.delivered / opened / clicked / bounced / complained.

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const raw = await request.text();

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  let evt: { type?: string; data?: { email_id?: string } };
  if (secret) {
    try {
      const wh = new Webhook(secret);
      evt = wh.verify(raw, {
        "svix-id": request.headers.get("svix-id") || "",
        "svix-timestamp": request.headers.get("svix-timestamp") || "",
        "svix-signature": request.headers.get("svix-signature") || "",
      }) as typeof evt;
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    evt = JSON.parse(raw);
  }

  const type = evt.type;
  const resendId = evt.data?.email_id;
  if (!type || !resendId) return NextResponse.json({ ok: true });

  const recipient = await prisma.emailRecipient.findFirst({ where: { resendId }, select: { id: true, campaignId: true, email: true, openedAt: true, clickedAt: true, bouncedAt: true } });
  if (!recipient) return NextResponse.json({ ok: true });

  const bump = (field: "openCount" | "clickCount" | "bounceCount" | "unsubscribeCount") =>
    prisma.emailCampaign.update({ where: { id: recipient.campaignId }, data: { [field]: { increment: 1 } } });

  switch (type) {
    case "email.opened":
      if (!recipient.openedAt) { await prisma.emailRecipient.update({ where: { id: recipient.id }, data: { openedAt: new Date() } }); await bump("openCount"); }
      break;
    case "email.clicked":
      if (!recipient.clickedAt) { await prisma.emailRecipient.update({ where: { id: recipient.id }, data: { clickedAt: new Date() } }); await bump("clickCount"); }
      break;
    case "email.bounced":
      if (!recipient.bouncedAt) { await prisma.emailRecipient.update({ where: { id: recipient.id }, data: { bouncedAt: new Date(), status: "FAILED", error: "bounced" } }); await bump("bounceCount"); }
      break;
    case "email.complained":
      await recordUnsubscribe(recipient.email, "complaint");
      await bump("unsubscribeCount");
      break;
  }

  return NextResponse.json({ ok: true });
}
