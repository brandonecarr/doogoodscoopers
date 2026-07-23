import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// PATCH → manually stop (remove) a single recipient from a campaign. Sets the
// recipient to STOPPED so the drip cron sends them no further steps AND won't
// re-enroll them (enrollment excludes leads that already have a recipient row).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; recipientId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, recipientId } = await params;
  const recipient = await prisma.campaignRecipient.findFirst({
    where: { id: recipientId, campaignId: id },
    select: { id: true },
  });
  if (!recipient) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.campaignRecipient.update({
    where: { id: recipientId },
    data: { status: "STOPPED", error: "manually stopped", nextSendAt: null },
  });
  return NextResponse.json({ success: true, recipient: updated });
}
