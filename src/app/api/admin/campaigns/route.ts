import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { LeadSource } from "@prisma/client";
import { parseDripInput } from "@/lib/drip-input";

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
  steps?: Array<{ body: string; delayMinutes?: number; channel?: string; subject?: string }>;
  stopOnReply?: boolean;
  channel?: string;
  draft?: boolean;
  excludeIds?: string[];
  includeNew?: boolean;
  emailFromName?: string;
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
    const isDraft = b.draft === true;
    // A draft can be saved incomplete; a live drip needs a trigger + a message.
    const { steps, audienceFilter, emailFromName, error } = parseDripInput(b, { draft: isDraft });
    if (error) return NextResponse.json({ error }, { status: 400 });

    const campaign = await prisma.campaign.create({
      data: {
        name: b.name.trim(),
        body: steps[0]?.body || "", // first message, for list display
        type: "DRIP",
        // Draft = parked and inert (the process-drips cron only runs active drips).
        status: isDraft ? "DRAFT" : "ACTIVE",
        active: !isDraft,
        stopOnReply: b.stopOnReply !== false,
        channel: b.channel === "messenger" ? "messenger" : "sms",
        audienceFilter,
        emailFromName,
        adminEmail: session.email,
        totalRecipients: 0,
        steps: { create: steps },
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
      // Approval gate: a blast is built and its audience resolved, but it waits
      // for the owner's explicit approval before the cron sends anything. The
      // process-campaigns cron only drains QUEUED/SENDING, so PENDING_APPROVAL
      // is inert until the owner approves it.
      status: "PENDING_APPROVAL",
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
