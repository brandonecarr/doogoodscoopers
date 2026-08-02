import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { verifyMessengerSignature, fetchMessengerProfile } from "@/lib/messenger";
import { sendAdminPush } from "@/lib/web-push";

// Meta Messenger Platform webhook.
//  GET  → verification handshake (Meta calls this once when you set the webhook).
//  POST → inbound message events. Each new customer message becomes a MESSENGER
//         lead + a LeadMessage, and fires an admin push so you know instantly.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const verifyToken = process.env.MESSENGER_VERIFY_TOKEN;
  if (mode === "subscribe" && verifyToken && token === verifyToken) {
    return new NextResponse(challenge || "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const raw = await request.text();

  // Verify the payload signature when an app secret is configured.
  if (process.env.META_APP_SECRET && !verifyMessengerSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (body?.object !== "page") return NextResponse.json({ ok: true });

  for (const entry of body.entry || []) {
    const pageId: string | undefined = entry?.id;
    for (const evt of entry?.messaging || []) {
      const psid: string | undefined = evt?.sender?.id;
      const text: string | undefined = evt?.message?.text;
      // Only handle real inbound text messages — skip echoes (our own sends),
      // delivery/read receipts, and attachment-only events for v1.
      if (!psid || evt?.message?.is_echo || !text) continue;

      try {
        let contact = await prisma.messengerLead.findUnique({ where: { psid } });
        if (!contact) {
          const profile = await fetchMessengerProfile(psid);
          contact = await prisma.messengerLead.create({
            data: {
              psid,
              pageId,
              name: profile.name,
              firstName: profile.firstName,
              lastName: profile.lastName,
              profilePicUrl: profile.profilePicUrl,
              lastMessage: text,
              lastMessageAt: new Date(),
              unread: true,
              rawPayload: evt as Prisma.InputJsonValue,
            },
          });
        } else {
          await prisma.messengerLead.update({
            where: { id: contact.id },
            data: { lastMessage: text, lastMessageAt: new Date(), unread: true, ...(contact.archived ? { archived: false } : {}) },
          });
        }

        await prisma.leadMessage.create({
          data: { leadType: "MESSENGER", leadId: contact.id, direction: "INBOUND", body: text, phone: psid, provider: "messenger" },
        });

        const who = contact.name || "Someone";
        sendAdminPush({
          title: `💬 New Facebook message from ${who}`,
          body: text.length > 140 ? text.slice(0, 137) + "…" : text,
          url: "/admin/messenger",
          tag: `messenger-${contact.id}`,
        }).catch((e) => console.error("[Messenger] push failed:", e));
      } catch (e) {
        console.error("[Messenger] failed to process message:", e);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
