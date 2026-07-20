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
  name: string;
  body: string;
  audienceFilter?: unknown;
  recipients: Array<{ leadType: LeadSource; leadId: string; phone: string; name?: string | null }>;
}

// POST → create a campaign + its recipient queue (status QUEUED; drained by cron)
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, body, audienceFilter, recipients } = (await request.json()) as CreateBody;
  if (!name?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "Name and message are required" }, { status: 400 });
  }
  if (!recipients?.length) {
    return NextResponse.json({ error: "No recipients selected" }, { status: 400 });
  }

  const campaign = await prisma.campaign.create({
    data: {
      name: name.trim(),
      body: body.trim(),
      status: "QUEUED",
      audienceFilter: (audienceFilter ?? undefined) as object | undefined,
      adminEmail: session.email,
      totalRecipients: recipients.length,
    },
  });

  await prisma.campaignRecipient.createMany({
    data: recipients.map((r) => ({
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
