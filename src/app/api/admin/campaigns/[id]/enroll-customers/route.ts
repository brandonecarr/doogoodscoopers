import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { optedOutKeys, optOutKey } from "@/lib/sms-optout";

// Manually enroll Sweep&Go customers into a DRIP campaign (e.g. a reviews drip).
// Enforces the rule that a customer marked REVIEW_COMPLETE can never be added.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { customerIds } = (await request.json()) as { customerIds?: string[] };
  if (!Array.isArray(customerIds) || customerIds.length === 0) {
    return NextResponse.json({ error: "No customers selected." }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { steps: { orderBy: { stepOrder: "asc" }, take: 1 } },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  if (campaign.type !== "DRIP") return NextResponse.json({ error: "Customers can only be added to drip campaigns." }, { status: 400 });

  const step0Delay = campaign.steps[0]?.delayMinutes ?? 0;
  const nextSendAt = new Date(Date.now() + step0Delay * 60_000);

  const [customers, existing, optedOut] = await Promise.all([
    prisma.sweepandgoCustomer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, reviewStatus: true, firstName: true, lastName: true, cellPhone: true, homePhone: true },
    }),
    prisma.campaignRecipient.findMany({ where: { campaignId: id, leadType: "CUSTOMER" }, select: { leadId: true } }),
    optedOutKeys(),
  ]);
  const byId = new Map(customers.map((c) => [c.id, c]));
  const enrolled = new Set(existing.map((e) => e.leadId));

  let added = 0;
  const skipped: { id: string; name: string | null; reason: string }[] = [];

  for (const cid of customerIds) {
    const c = byId.get(cid);
    const name = c ? [c.firstName, c.lastName].filter(Boolean).join(" ") || null : null;
    if (!c) { skipped.push({ id: cid, name, reason: "not found" }); continue; }
    if (c.reviewStatus === "REVIEW_COMPLETE") { skipped.push({ id: cid, name, reason: "review already completed" }); continue; }
    const phone = c.cellPhone || c.homePhone || "";
    if (!phone) { skipped.push({ id: cid, name, reason: "no phone number" }); continue; }
    const k = optOutKey(phone);
    if (k && optedOut.has(k)) { skipped.push({ id: cid, name, reason: "opted out of texts" }); continue; }
    if (enrolled.has(cid)) { skipped.push({ id: cid, name, reason: "already in this campaign" }); continue; }

    try {
      await prisma.campaignRecipient.create({
        data: {
          campaignId: id, leadType: "CUSTOMER", leadId: cid, phone, name,
          status: "ACTIVE", currentStep: 0, nextSendAt,
        },
      });
      enrolled.add(cid);
      added++;
    } catch {
      // unique(campaignId, leadType, leadId) race → treat as already enrolled
      skipped.push({ id: cid, name, reason: "already in this campaign" });
    }
  }

  if (added > 0) {
    await prisma.campaign.update({ where: { id }, data: { totalRecipients: { increment: added } } });
  }
  return NextResponse.json({ added, skipped });
}
