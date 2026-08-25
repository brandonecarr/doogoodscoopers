import { NextRequest, NextResponse, after } from "next/server";
import prisma from "@/lib/prisma";
import { verifyMetaSignature, messengerVerifyToken, getMessengerProfile } from "@/lib/messenger";
import { notify } from "@/lib/notify";

// Facebook Messenger webhook.
//  GET  → verification handshake (paste this URL into Messenger API Settings).
//  POST → messaging events. We capture the sender PSID, auto-link it to the
//         matching AdLead (by name), log inbound replies, refresh the 24h/7d
//         window, and stop any stop-on-reply drip for that lead.

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const verify = messengerVerifyToken();
  if (mode === "subscribe" && verify && token === verify) {
    return new NextResponse(challenge || "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/** Find the AdLead for a PSID: already-linked, else best-effort match by name
 *  among recent, unlinked Meta leads. Claims the PSID on first match. */
async function linkPsidToLead(psid: string): Promise<{ id: string; phone: string | null } | null> {
  const existing = await prisma.adLead.findUnique({ where: { messengerPsid: psid }, select: { id: true, phone: true } });
  if (existing) return existing;

  const profile = await getMessengerProfile(psid);
  if (!profile?.name) return null;
  const target = norm(profile.name);

  const recent = await prisma.adLead.findMany({
    where: { archived: false, messengerPsid: null, createdAt: { gte: new Date(Date.now() - 14 * 86_400_000) } },
    select: { id: true, phone: true, firstName: true, lastName: true, fullName: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  const match = recent.find((l) => {
    const full = norm(l.fullName || [l.firstName, l.lastName].filter(Boolean).join(" "));
    return full && full === target;
  });
  if (!match) return null;
  try {
    await prisma.adLead.update({ where: { id: match.id }, data: { messengerPsid: psid } });
    return { id: match.id, phone: match.phone };
  } catch {
    // Race: someone else claimed it — return whoever holds it now.
    return prisma.adLead.findUnique({ where: { messengerPsid: psid }, select: { id: true, phone: true } });
  }
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (process.env.META_APP_SECRET && !verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }
  if (body?.object !== "page") return NextResponse.json({ ok: true });

  // Ack fast; process in the background (Meta expects a quick 200).
  after(async () => {
    try {
      for (const entry of body.entry ?? []) {
        for (const ev of entry.messaging ?? []) {
          const psid: string | undefined = ev?.sender?.id;
          if (!psid) continue;
          // Only inbound signals from the user (not our own echoes).
          const isEcho = ev.message?.is_echo === true;
          const inbound = (ev.message && !isEcho) || ev.postback || ev.referral || ev.optin;
          if (!inbound) continue;

          const lead = await linkPsidToLead(psid);
          if (!lead) continue; // unmatched thread → the lead still gets the SMS fallback

          // Refresh the messaging window on any inbound signal.
          await prisma.adLead.update({ where: { id: lead.id }, data: { messengerLastInboundAt: new Date() } }).catch(() => {});

          const text: string = ev.message?.text || ev.postback?.title || "";
          if (!text) continue;

          await prisma.leadMessage.create({
            data: { leadType: "AD_LEAD", leadId: lead.id, direction: "INBOUND", body: text, phone: lead.phone ?? "", provider: "messenger", status: "DELIVERED" },
          }).catch(() => {});

          // Stop any stop-on-reply drip for this lead (mirrors the Quo webhook).
          const active = await prisma.campaignRecipient.findMany({
            where: { leadType: "AD_LEAD", leadId: lead.id, status: "ACTIVE" },
            select: { id: true, campaignId: true },
          });
          if (active.length) {
            const stopCampaigns = await prisma.campaign.findMany({
              where: { id: { in: active.map((r) => r.campaignId) }, type: "DRIP", stopOnReply: true },
              select: { id: true },
            });
            const stopSet = new Set(stopCampaigns.map((c) => c.id));
            const stopIds = active.filter((r) => stopSet.has(r.campaignId)).map((r) => r.id);
            if (stopIds.length) {
              await prisma.campaignRecipient.updateMany({ where: { id: { in: stopIds } }, data: { status: "STOPPED", error: "lead replied (messenger)", nextSendAt: null } });
            }
          }

          const who = await prisma.adLead.findUnique({ where: { id: lead.id }, select: { firstName: true, fullName: true } });
          await notify({
            type: "lead_replied",
            severity: "info",
            title: "💬 Lead replied on Messenger",
            body: `${who?.firstName || who?.fullName || "A lead"}: ${text.slice(0, 60)}`,
            link: `/admin/ad-leads/${lead.id}`,
            push: true,
          });
        }
      }
    } catch (e) {
      console.error("[messenger webhook]", e);
    }
  });

  return NextResponse.json({ ok: true });
}
