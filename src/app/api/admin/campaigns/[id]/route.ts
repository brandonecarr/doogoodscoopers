import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

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
  const { active } = await request.json();
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
          audienceFilter: { leadTypes: b.leadTypes },
          steps: {
            create: steps.map((s: { body: string; delayMinutes?: number }, i: number) => ({
              stepOrder: i,
              body: s.body.trim(),
              delayMinutes: i === 0 ? 0 : Math.max(0, Math.round(s.delayMinutes || 0)),
            })),
          },
        },
      }),
    ]);
    return NextResponse.json({ success: true });
  }

  // Blast
  if (!b.body?.trim()) return NextResponse.json({ error: "Message is required" }, { status: 400 });
  await prisma.campaign.update({ where: { id }, data: { name: b.name.trim(), body: b.body.trim() } });
  return NextResponse.json({ success: true });
}
