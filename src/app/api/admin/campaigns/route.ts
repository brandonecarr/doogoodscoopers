import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { LeadSource } from "@prisma/client";

// GET → list campaigns (newest first)
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ campaigns });
}

interface CreateBody {
  type?: "blast" | "drip";
  name: string;
  // blast
  body?: string;
  audienceFilter?: unknown;
  recipients?: Array<{ leadType: LeadSource; leadId: string; phone: string; name?: string | null }>;
  // drip
  leadTypes?: string[];
  steps?: Array<{ body: string; delayDays?: number }>;
  stopOnReply?: boolean;
}

// POST → create a blast (queued recipients) or a drip (trigger + steps; the
// process-drips cron enrolls matching leads and sends the sequence over time).
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = (await request.json()) as CreateBody;
  if (!b.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  // ── Drip ──────────────────────────────────────────────────────────────────
  if (b.type === "drip") {
    if (!b.leadTypes?.length) {
      return NextResponse.json({ error: "Pick at least one trigger lead type" }, { status: 400 });
    }
    const steps = (b.steps || []).filter((s) => s.body?.trim());
    if (steps.length === 0) return NextResponse.json({ error: "Add at least one message" }, { status: 400 });

    const campaign = await prisma.campaign.create({
      data: {
        name: b.name.trim(),
        body: steps[0].body.trim(), // first message, for list display
        type: "DRIP",
        status: "ACTIVE",
        active: true,
        stopOnReply: b.stopOnReply !== false,
        audienceFilter: { leadTypes: b.leadTypes },
        adminEmail: session.email,
        totalRecipients: 0,
        steps: {
          create: steps.map((s, i) => ({
            stepOrder: i,
            body: s.body.trim(),
            delayHours: i === 0 ? 0 : Math.max(0, Math.round((s.delayDays || 0) * 24)),
          })),
        },
      },
    });
    return NextResponse.json({ success: true, campaign });
  }

  // ── Blast (default) ─────────────────────────────────────────────────────────
  if (!b.body?.trim()) return NextResponse.json({ error: "Message is required" }, { status: 400 });
  if (!b.recipients?.length) return NextResponse.json({ error: "No recipients selected" }, { status: 400 });

  const campaign = await prisma.campaign.create({
    data: {
      name: b.name.trim(),
      body: b.body.trim(),
      type: "BLAST",
      status: "QUEUED",
      audienceFilter: (b.audienceFilter ?? undefined) as object | undefined,
      adminEmail: session.email,
      totalRecipients: b.recipients.length,
    },
  });

  await prisma.campaignRecipient.createMany({
    data: b.recipients.map((r) => ({
      campaignId: campaign.id,
      leadType: r.leadType,
      leadId: r.leadId,
      phone: r.phone,
      name: r.name ?? null,
      status: "PENDING",
    })),
  });

  return NextResponse.json({ success: true, campaign });
}
