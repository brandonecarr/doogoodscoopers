import { NextRequest, NextResponse, after } from "next/server";
import prisma from "@/lib/prisma";
import { verifyMessengerSignature, hasMessengerSecret, messengerVerifyToken, getMessengerProfile, sendMessengerMessage, isMessengerConfigured } from "@/lib/messenger";
import { notify } from "@/lib/notify";
import { setSetting } from "@/lib/google-business";

// Facebook Messenger webhook.
//  GET  → verification handshake (paste this URL into Messenger API Settings).
//  POST → messaging events. We capture the sender PSID, link/create the AdLead,
//         log inbound replies, refresh the 24h/7d window, stop any stop-on-reply
//         drip, and send a one-time auto-reply to a new Page conversation.

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DEFAULT_AUTOREPLY =
  "Hey! Thanks for reaching out to DooGoodScoopers 🐾 Happy to help — what's your ZIP code and how many dogs do you have? I'll get you a quick quote.";

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

/** Resolve a PSID to an AdLead: already-linked, else match a recent unlinked
 *  lead by name, else create a fresh lead from the Messenger thread. */
async function linkOrCreateLead(psid: string): Promise<{ id: string; phone: string | null } | null> {
  const existing = await prisma.adLead.findUnique({ where: { messengerPsid: psid }, select: { id: true, phone: true } });
  if (existing) return existing;

  const profile = await getMessengerProfile(psid);
  const name = profile?.name;

  if (name) {
    const target = norm(name);
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
    if (match) {
      try {
        await prisma.adLead.update({ where: { id: match.id }, data: { messengerPsid: psid } });
        return { id: match.id, phone: match.phone };
      } catch {
        return prisma.adLead.findUnique({ where: { messengerPsid: psid }, select: { id: true, phone: true } });
      }
    }
  }

  // No match → this person messaged the Page cold; capture them as a lead.
  try {
    const created = await prisma.adLead.create({
      data: { adSource: "messenger", messengerPsid: psid, firstName: profile?.firstName ?? null, lastName: profile?.lastName ?? null, fullName: name ?? null, status: "NEW" },
      select: { id: true, phone: true },
    });
    return created;
  } catch {
    return prisma.adLead.findUnique({ where: { messengerPsid: psid }, select: { id: true, phone: true } });
  }
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const sigOk = !hasMessengerSecret() || verifyMessengerSignature(raw, request.headers.get("x-hub-signature-256"));
  // Diagnostic breadcrumb (readable via AppSetting) to confirm delivery + signature.
  let obj = "?";
  try { obj = JSON.parse(raw)?.object ?? "?"; } catch { /* ignore */ }
  await setSetting("messenger.lastHit", `${new Date().toISOString()} sig=${sigOk ? "ok" : "FAIL"} object=${obj} len=${raw.length}`).catch(() => {});

  if (!sigOk) return new NextResponse("Invalid signature", { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }
  if (body?.object !== "page") return NextResponse.json({ ok: true });

  after(async () => {
    try {
      for (const entry of body.entry ?? []) {
        for (const ev of entry.messaging ?? []) {
          const psid: string | undefined = ev?.sender?.id;
          if (!psid) continue;
          const isEcho = ev.message?.is_echo === true;
          const inbound = (ev.message && !isEcho) || ev.postback || ev.referral || ev.optin;
          if (!inbound) continue;

          const lead = await linkOrCreateLead(psid);
          if (!lead) continue;

          await prisma.adLead.update({ where: { id: lead.id }, data: { messengerLastInboundAt: new Date() } }).catch(() => {});

          const text: string = ev.message?.text || ev.postback?.title || "";
          if (text) {
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
          }

          // One-time auto-reply: instant response to a new Page conversation.
          // Fires once per thread (no prior outbound), satisfies pages_messaging,
          // and never repeats — so it doesn't fight stop-on-reply.
          if (isMessengerConfigured()) {
            const priorOut = await prisma.leadMessage.count({
              where: { leadType: "AD_LEAD", leadId: lead.id, provider: "messenger", direction: "OUTBOUND" },
            });
            if (priorOut === 0) {
              const greeting = (await prisma.appSetting.findUnique({ where: { key: "messenger.autoReply" } }))?.value || DEFAULT_AUTOREPLY;
              const m = await sendMessengerMessage({ psid, text: greeting });
              if (m.ok) {
                await prisma.leadMessage.create({
                  data: { leadType: "AD_LEAD", leadId: lead.id, direction: "OUTBOUND", body: greeting, phone: lead.phone ?? "", provider: "messenger", status: "SENT" },
                }).catch(() => {});
              } else {
                console.error("[messenger webhook] auto-reply failed:", m.error);
              }
            }
          }

          const who = await prisma.adLead.findUnique({ where: { id: lead.id }, select: { firstName: true, fullName: true } });
          await notify({
            type: "lead_replied",
            severity: "info",
            title: "💬 New Messenger message",
            body: `${who?.firstName || who?.fullName || "A lead"}${text ? `: ${text.slice(0, 60)}` : " started a conversation"}`,
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
