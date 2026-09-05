import { NextRequest, NextResponse, after } from "next/server";
import prisma from "@/lib/prisma";
import { verifyMessengerSignature, hasMessengerSecret, messengerVerifyToken, getMessengerProfileDetailed, sendMessengerMessage, isMessengerConfigured } from "@/lib/messenger";
import { notify } from "@/lib/notify";
import { setSetting, getSetting } from "@/lib/google-business";

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

interface Hit { at: string; sig: "ok" | "FAIL"; object: string; events: number; len: number; outcome: string }
/** Keep the last 8 webhook deliveries in AppSetting messenger.recentHits. Returns the index of this one. */
async function recordHit(h: Hit): Promise<number> {
  let hits: Hit[] = [];
  try { hits = JSON.parse((await getSetting("messenger.recentHits")) || "[]"); } catch { hits = []; }
  hits.unshift(h); hits = hits.slice(0, 8);
  await setSetting("messenger.recentHits", JSON.stringify(hits)).catch(() => {});
  return 0;
}
async function updateHitOutcome(idx: number, outcome: string) {
  try {
    const hits: Hit[] = JSON.parse((await getSetting("messenger.recentHits")) || "[]");
    if (hits[idx]) { hits[idx].outcome = outcome; await setSetting("messenger.recentHits", JSON.stringify(hits)); }
  } catch { /* ignore */ }
}

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

/** Resolve a PSID to an AdLead. `matched` = it was an existing ad/form lead (a
 *  real funnel lead); `false` = a cold messager we just captured. We only
 *  auto-greet matched leads. */
const PLACEHOLDER_NAME = "Messenger user";

async function linkOrCreateLead(psid: string): Promise<{ id: string; phone: string | null; matched: boolean; note?: string } | null> {
  const { profile, error: profileError } = await getMessengerProfileDetailed(psid);
  const name = profile?.name;

  const existing = await prisma.adLead.findUnique({ where: { messengerPsid: psid }, select: { id: true, phone: true, adSource: true, fullName: true } });
  if (existing) {
    // A lead captured before their name was readable gets it filled in now.
    if (name && (!existing.fullName || existing.fullName === PLACEHOLDER_NAME)) {
      await prisma.adLead.update({ where: { id: existing.id }, data: { fullName: name, firstName: profile?.firstName ?? null, lastName: profile?.lastName ?? null } }).catch(() => {});
    }
    return { id: existing.id, phone: existing.phone, matched: existing.adSource !== "messenger" };
  }

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
        return { id: match.id, phone: match.phone, matched: true }; // a real form/ad lead
      } catch {
        const held = await prisma.adLead.findUnique({ where: { messengerPsid: psid }, select: { id: true, phone: true, adSource: true } });
        return held ? { id: held.id, phone: held.phone, matched: held.adSource !== "messenger" } : null;
      }
    }
  }

  // No match: capture the messager as a lead. When Facebook won't give us the
  // name (Development mode only reads names of people with a role on the app;
  // Live mode needs Business Asset User Profile Access), the lead is created
  // under a placeholder and renamed on their next message once readable.
  // Dropping the message instead would lose a real conversation.
  try {
    const created = await prisma.adLead.create({
      data: { adSource: "messenger", messengerPsid: psid, firstName: profile?.firstName ?? null, lastName: profile?.lastName ?? null, fullName: name || PLACEHOLDER_NAME, status: "NEW" },
      select: { id: true, phone: true },
    });
    return { id: created.id, phone: created.phone, matched: false, note: name ? undefined : `name unreadable: ${profileError || "no profile returned"}` };
  } catch {
    const held = await prisma.adLead.findUnique({ where: { messengerPsid: psid }, select: { id: true, phone: true, adSource: true } });
    return held ? { id: held.id, phone: held.phone, matched: held.adSource !== "messenger" } : null;
  }
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const sigOk = !hasMessengerSecret() || verifyMessengerSignature(raw, request.headers.get("x-hub-signature-256"));
  // Diagnostic breadcrumbs: the last few deliveries, with signature result and
  // what we did with each, shown on /admin/messenger. Answers "did Facebook
  // even call us?" without digging through server logs.
  let obj = "?"; let events = 0;
  try { const b = JSON.parse(raw); obj = b?.object ?? "?"; events = (b?.entry ?? []).reduce((n: number, e: { messaging?: unknown[] }) => n + (e.messaging?.length ?? 0), 0); } catch { /* ignore */ }
  const hitId = await recordHit({ at: new Date().toISOString(), sig: sigOk ? "ok" : "FAIL", object: obj, events, len: raw.length, outcome: sigOk ? "received" : "rejected: bad signature" });

  if (!sigOk) return new NextResponse("Invalid signature", { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }
  if (body?.object !== "page") return NextResponse.json({ ok: true });

  after(async () => {
    const done: string[] = [];
    try {
      for (const entry of body.entry ?? []) {
        for (const ev of entry.messaging ?? []) {
          const psid: string | undefined = ev?.sender?.id;
          if (!psid) continue;
          const isEcho = ev.message?.is_echo === true;
          const inbound = (ev.message && !isEcho) || ev.postback || ev.referral || ev.optin;
          if (!inbound) continue;

          const lead = await linkOrCreateLead(psid);
          if (!lead) { done.push("could not resolve lead"); continue; }
          done.push(`${lead.matched ? "matched" : "created"} lead ${lead.id}${lead.note ? ` (${lead.note})` : ""}`);

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

          // One-time auto-greeting: a single instant reply the FIRST time a
          // conversation starts, then it stays silent so humans/drips take over.
          // Off by default unless enabled; the atomic greetedAt guard means it
          // can never fire twice for the same person, even on rapid messages.
          // Only greet real ad/form leads — not cold random messagers.
          const autoReplyOn = (await getSetting("messenger.autoReplyEnabled")) === "true";
          // Review/testing mode: greet EVERYONE (not just matched ad/form leads),
          // so the owner can record the App Review screencast and Meta's reviewer
          // gets a reply when they message the Page cold. Turn OFF after approval.
          const greetEveryone = (await getSetting("messenger.greetEveryone")) === "true";
          if (autoReplyOn && (lead.matched || greetEveryone) && (await isMessengerConfigured())) {
            const won = await prisma.adLead.updateMany({
              where: { id: lead.id, messengerGreetedAt: null },
              data: { messengerGreetedAt: new Date() },
            });
            if (won.count === 1) {
              const greeting = (await getSetting("messenger.autoReply")) || DEFAULT_AUTOREPLY;
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
      await updateHitOutcome(hitId, done.length ? done.join("; ") : "no inbound events (echo/read/delivery receipts)");
    } catch (e) {
      console.error("[messenger webhook]", e);
      await updateHitOutcome(hitId, `error: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  return NextResponse.json({ ok: true });
}
