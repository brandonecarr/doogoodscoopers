import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { LeadStatus } from "@/types/leads";

const VALID_STATUS: LeadStatus[] = ["NEW", "CONTACTED", "NO_ANSWER", "NOT_INTERESTED", "WAITING_FOR_SIGNUP", "CONVERTED"];

// PATCH → update an Instagram lead (status / grade / followup / notes / archived).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await request.json();

  const data: Record<string, unknown> = {};
  if (typeof b.status === "string" && VALID_STATUS.includes(b.status)) data.status = b.status;
  if (b.grade === null || (typeof b.grade === "string" && ["A", "B", "C", "D", "F"].includes(b.grade))) data.grade = b.grade;
  if (b.followupDate !== undefined) data.followupDate = b.followupDate ? new Date(b.followupDate) : null;
  if (typeof b.notes === "string") data.notes = b.notes;
  if (typeof b.archived === "boolean") data.archived = b.archived;

  const lead = await prisma.instagramLead.update({ where: { id }, data });

  await prisma.activityLog.create({
    data: {
      action: b.archived !== undefined ? "LEAD_ARCHIVED" : b.status ? "STATUS_UPDATE" : "LEAD_UPDATE",
      leadType: "INSTAGRAM",
      leadId: id,
      details: data as object,
      adminEmail: session.email,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, lead });
}

// DELETE → remove an Instagram lead.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.instagramLead.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
