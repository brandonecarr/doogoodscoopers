import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// PATCH → stop or restart a single campaign recipient.
//   action "stop"    → STOPPED (no further sends; the drip cron won't re-enroll
//                      them, since enrollment excludes leads that already have a
//                      recipient row).
//   action "restart" → put them back in the flow: DRIP → ACTIVE, resuming at the
//                      current step with an immediate next send; BLAST → PENDING,
//                      re-queued for the next send pass.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; recipientId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, recipientId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body?.action === "restart" ? "restart" : "stop";

  const [recipient, campaign] = await Promise.all([
    prisma.campaignRecipient.findFirst({ where: { id: recipientId, campaignId: id }, select: { id: true } }),
    prisma.campaign.findUnique({ where: { id }, select: { type: true } }),
  ]);
  if (!recipient || !campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data =
    action === "restart"
      ? campaign.type === "DRIP"
        ? { status: "ACTIVE", error: null, nextSendAt: new Date() }
        : { status: "PENDING", error: null, nextSendAt: null }
      : { status: "STOPPED", error: "manually stopped", nextSendAt: null };

  const updated = await prisma.campaignRecipient.update({ where: { id: recipientId }, data });
  return NextResponse.json({ success: true, recipient: updated });
}
