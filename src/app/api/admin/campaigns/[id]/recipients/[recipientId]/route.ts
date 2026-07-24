import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// PATCH → stop or restart a single campaign recipient.
//   action "stop"    → STOPPED, no further sends. Keeps nextSendAt intact (the
//                      cron ignores non-ACTIVE rows) so a later restart can
//                      resume on the ORIGINAL schedule. The drip cron won't
//                      re-enroll them, since enrollment excludes leads that
//                      already have a recipient row.
//   action "restart" → put them back in the flow on their original schedule:
//                      DRIP → ACTIVE keeping the preserved nextSendAt (if that
//                      time already passed while stopped, it goes out on the next
//                      tick; it never fires early); BLAST → PENDING, re-queued.
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
    prisma.campaignRecipient.findFirst({ where: { id: recipientId, campaignId: id }, select: { id: true, nextSendAt: true } }),
    prisma.campaign.findUnique({ where: { id }, select: { type: true } }),
  ]);
  if (!recipient || !campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data =
    action === "restart"
      ? campaign.type === "DRIP"
        ? // Resume on the schedule preserved at stop time. Fall back to now only
          // if none survived (e.g. stopped before this behavior existed).
          { status: "ACTIVE", error: null, nextSendAt: recipient.nextSendAt ?? new Date() }
        : { status: "PENDING", error: null, nextSendAt: null }
      : // Stop but PRESERVE nextSendAt so restart resumes on the original time.
        { status: "STOPPED", error: "manually stopped" };

  const updated = await prisma.campaignRecipient.update({ where: { id: recipientId }, data });
  return NextResponse.json({ success: true, recipient: updated });
}
