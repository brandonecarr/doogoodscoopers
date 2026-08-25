import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { rescheduleActiveRecipients } from "@/lib/drip-schedule";

// GET → campaign detail + recipient status breakdown
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const grouped = await prisma.campaignRecipient.groupBy({
    by: ["status"],
    where: { campaignId: id },
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const g of grouped) counts[g.status] = g._count._all;

  return NextResponse.json({ campaign, counts });
}

// PATCH → pause/resume a drip (or other campaign fields)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  // Approve a blast that's awaiting approval → queue it for the send cron.
  if (body.approve === true) {
    const c = await prisma.campaign.findUnique({ where: { id } });
    if (!c || c.type !== "BLAST") return NextResponse.json({ error: "Not a blast" }, { status: 400 });
    if (c.status !== "PENDING_APPROVAL") return NextResponse.json({ error: "This blast isn't awaiting approval." }, { status: 409 });
    const campaign = await prisma.campaign.update({ where: { id }, data: { status: "QUEUED" } });
    return NextResponse.json({ success: true, campaign });
  }

  // Reject a pending blast → send it back to draft (nothing goes out).
  if (body.reject === true) {
    const c = await prisma.campaign.findUnique({ where: { id } });
    if (!c || c.type !== "BLAST") return NextResponse.json({ error: "Not a blast" }, { status: 400 });
    const campaign = await prisma.campaign.update({ where: { id }, data: { status: "DRAFT" } });
    return NextResponse.json({ success: true, campaign });
  }

  // Activate a draft: go live now. Reset createdAt so trigger-based auto-enroll
  // starts from activation time (not draft-creation) and doesn't backfill.
  if (body.activate === true) {
    const campaign = await prisma.campaign.update({
      where: { id },
      data: { active: true, status: "ACTIVE", createdAt: new Date() },
    });
    return NextResponse.json({ success: true, campaign });
  }

  const { active } = body;
  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "active (boolean) required" }, { status: 400 });
  }
  const campaign = await prisma.campaign.update({ where: { id }, data: { active } });
  return NextResponse.json({ success: true, campaign });
}

// PUT → edit a campaign. Drip: name, trigger, stop-on-reply, and the full step
// sequence (replaced). Blast: name + message.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.campaign.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const b = await request.json();
  if (!b.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  if (existing.type === "DRIP") {
    if (!b.leadTypes?.length) return NextResponse.json({ error: "Pick at least one trigger lead type" }, { status: 400 });
    const steps = (b.steps || []).filter((s: { body?: string }) => s.body?.trim());
    if (steps.length === 0) return NextResponse.json({ error: "Add at least one message" }, { status: 400 });

    await prisma.$transaction([
      prisma.campaignStep.deleteMany({ where: { campaignId: id } }),
      prisma.campaign.update({
        where: { id },
        data: {
          name: b.name.trim(),
          body: steps[0].body.trim(),
          stopOnReply: b.stopOnReply !== false,
          ...(b.channel ? { channel: b.channel === "messenger" ? "messenger" : "sms" } : {}),
          audienceFilter: { leadTypes: b.leadTypes },
          steps: {
            create: steps.map((s: { body: string; delayMinutes?: number }, i: number) => ({
              stepOrder: i,
              body: s.body.trim(),
              delayMinutes: Math.max(0, Math.round(s.delayMinutes || 0)),
            })),
          },
        },
      }),
    ]);

    // Apply the (possibly changed) step delays to anyone already mid-sequence:
    // reschedule their next send off their last send using the new interval.
    const rescheduled = await rescheduleActiveRecipients(id);

    return NextResponse.json({ success: true, rescheduled });
  }

  // Blast
  if (!b.body?.trim()) return NextResponse.json({ error: "Message is required" }, { status: 400 });
  await prisma.campaign.update({ where: { id }, data: { name: b.name.trim(), body: b.body.trim() } });
  return NextResponse.json({ success: true });
}
