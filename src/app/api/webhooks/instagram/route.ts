import crypto from "crypto";
import { NextRequest, NextResponse, after } from "next/server";
import prisma from "@/lib/prisma";
import { verifyMetaSignature, matchesKeywords, renderDm } from "@/lib/instagram";
import { deliverInstagramDm } from "@/lib/instagram-deliver";

// Instagram webhook.
//  GET  → verification handshake (Meta calls this once when you set the webhook).
//  POST → comment events. Each comment that matches an active keyword campaign
//         is queued as an InstagramDm; the process-instagram-dms cron sends it.

export const dynamic = "force-dynamic";
// after() sends the DM in the background once we've already 200'd Meta; give it room.
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const verifyToken = process.env.IG_VERIFY_TOKEN;
  if (mode === "subscribe" && verifyToken && token === verifyToken) {
    return new NextResponse(challenge || "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const sigOk = process.env.META_APP_SECRET
    ? verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"))
    : null;

  // TEMP debug: record every inbound POST before any filtering, so we can tell
  // "Meta isn't delivering" apart from "arriving but dropped (signature/match)".
  const sigHeader = request.headers.get("x-hub-signature-256");
  const expectedSig = process.env.META_APP_SECRET
    ? "sha256=" + crypto.createHmac("sha256", process.env.META_APP_SECRET).update(raw, "utf8").digest("hex")
    : null;
  try {
    let objType: string | null = null;
    try {
      objType = (JSON.parse(raw)?.object as string) ?? null;
    } catch {
      /* not JSON */
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "IgWebhookEvent" ("sigOk","objectType","raw","sigHeader","expectedSig") VALUES ($1,$2,$3,$4,$5)`,
      sigOk,
      objType,
      raw.slice(0, 4000),
      sigHeader,
      expectedSig,
    );
  } catch {
    /* logging must never break the webhook */
  }

  if (process.env.META_APP_SECRET && !sigOk) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (body?.object !== "instagram") return NextResponse.json({ ok: true });

  const ourAccountId = process.env.IG_ACCOUNT_ID;
  const campaigns = await prisma.instagramCampaign.findMany({ where: { active: true } });
  if (campaigns.length === 0) return NextResponse.json({ ok: true });

  // Rows freshly queued this request, to deliver inline (after we respond to Meta).
  const toDeliver: Array<{
    dm: { id: string; commentId: string; text: string; campaignId: string };
    publicReply: string | null;
  }> = [];

  for (const entry of body.entry || []) {
    for (const change of entry?.changes || []) {
      if (change?.field !== "comments") continue;
      const v = change.value || {};
      const commentId: string | undefined = v.id;
      const text: string | undefined = v.text;
      const mediaId: string | undefined = v.media?.id;
      const fromId: string | undefined = v.from?.id;
      const username: string | undefined = v.from?.username;

      if (!commentId || !text) continue;
      // Ignore our own comments so we never reply to ourselves.
      if (ourAccountId && fromId === ourAccountId) continue;

      // First active campaign whose media (or "any") + keywords match this comment.
      const campaign = campaigns.find(
        (c) => (!c.mediaId || c.mediaId === mediaId) && matchesKeywords(text, c.keywords, c.matchType)
      );
      if (!campaign) continue;

      try {
        const created = await prisma.instagramDm.create({
          data: {
            campaignId: campaign.id,
            commentId, // unique → a comment is only ever answered once
            mediaId,
            igUserId: fromId,
            username,
            commentText: text,
            text: renderDm(campaign.dmText, { username }),
            status: "QUEUED",
          },
        });
        await prisma.instagramCampaign.update({ where: { id: campaign.id }, data: { matchedCount: { increment: 1 } } });
        toDeliver.push({
          dm: { id: created.id, commentId: created.commentId, text: created.text, campaignId: created.campaignId },
          publicReply: campaign.publicReply,
        });
      } catch {
        // unique(commentId) → already queued/handled; skip silently.
      }
    }
  }

  // Deliver right away in the background — Meta gets its 200 immediately, and the
  // DM goes out in ~1s instead of waiting up to a minute for the cron. Anything
  // that fails or gets rate-limited here stays QUEUED/RATE_LIMITED for the cron.
  if (toDeliver.length > 0) {
    after(async () => {
      for (const item of toDeliver) {
        await deliverInstagramDm(item.dm, item.publicReply).catch(() => {});
      }
    });
  }

  return NextResponse.json({ ok: true });
}
