import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyUnsubToken, recordUnsubscribe, normalizeEmail } from "@/lib/email-unsubscribe";

// Public unsubscribe endpoint. Supports RFC 8058 one-click (POST) and GET.

async function unsubscribe(token: string): Promise<boolean> {
  const email = verifyUnsubToken(token);
  if (!email) return false;
  await recordUnsubscribe(email, "unsubscribe");
  // Best-effort: attribute to the most recent campaign this address received.
  const last = await prisma.emailRecipient.findFirst({ where: { email: { equals: normalizeEmail(email), mode: "insensitive" } }, orderBy: { createdAt: "desc" }, select: { campaignId: true } });
  if (last) await prisma.emailCampaign.update({ where: { id: last.campaignId }, data: { unsubscribeCount: { increment: 1 } } }).catch(() => {});
  return true;
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || (await request.text().then((t) => new URLSearchParams(t).get("token")).catch(() => null)) || "";
  const ok = await unsubscribe(token);
  return NextResponse.json({ success: ok });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const ok = await unsubscribe(token);
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <div style="font-family:Arial,sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#111">
       <h2>${ok ? "You've been unsubscribed" : "Link expired"}</h2>
       <p style="color:#666">${ok ? "You won't receive further marketing emails from DooGoodScoopers." : "Please use the unsubscribe link from a recent email."}</p>
     </div>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html" } }
  );
}
