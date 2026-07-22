import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { buildEmailRecipients, type EmailFilters } from "@/lib/email-audience";
import { sendCampaignBatch, isEmailConfigured } from "@/lib/email-send";

// GET  → list campaigns
// POST → { action: "draft" | "test" | "send" | "schedule", ...campaign, testEmail?, scheduledAt? }

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const campaigns = await prisma.emailCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ campaigns });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await request.json();
  const action = b.action as string;
  if (!b.subject?.trim() || !b.html?.trim()) {
    return NextResponse.json({ error: "Subject and content are required." }, { status: 400 });
  }
  const from = { fromName: b.fromName || null, fromEmail: b.fromEmail || null, replyTo: b.replyTo || null };

  // Test send — one email, nothing persisted.
  if (action === "test") {
    if (!b.testEmail?.trim()) return NextResponse.json({ error: "Test email is required." }, { status: 400 });
    if (!isEmailConfigured()) return NextResponse.json({ error: "Resend not configured." }, { status: 400 });
    const [r] = await sendCampaignBatch({
      subject: `[TEST] ${b.subject}`,
      html: b.html,
      from,
      recipients: [{ id: "test", email: b.testEmail.trim(), name: session.email }],
    });
    return NextResponse.json({ success: !!r.resendId, error: r.error });
  }

  const filter = (b.audienceFilter || {}) as EmailFilters;

  const campaign = await prisma.emailCampaign.create({
    data: {
      name: b.name?.trim() || b.subject.trim(),
      subject: b.subject.trim(),
      fromName: from.fromName,
      fromEmail: from.fromEmail,
      replyTo: from.replyTo,
      html: b.html,
      designJson: b.designJson ?? undefined,
      audienceFilter: filter as object,
      adminEmail: session.email,
      status: action === "draft" ? "DRAFT" : action === "schedule" ? "SCHEDULED" : "QUEUED",
      scheduledAt: action === "schedule" && b.scheduledAt ? new Date(b.scheduledAt) : null,
    },
  });

  // Draft: no recipients yet.
  if (action === "draft") return NextResponse.json({ success: true, campaign });

  // Build + persist the audience for send/schedule.
  const recipients = await buildEmailRecipients(filter);
  if (recipients.length === 0) {
    await prisma.emailCampaign.update({ where: { id: campaign.id }, data: { status: "DRAFT" } });
    return NextResponse.json({ error: "No recipients match this audience.", campaign }, { status: 400 });
  }
  await prisma.emailRecipient.createMany({
    data: recipients.map((r) => ({ campaignId: campaign.id, email: r.email, name: r.name, contactType: r.contactType, contactId: r.contactId })),
    skipDuplicates: true,
  });
  await prisma.emailCampaign.update({ where: { id: campaign.id }, data: { totalRecipients: recipients.length } });

  return NextResponse.json({ success: true, campaign, recipients: recipients.length });
}
