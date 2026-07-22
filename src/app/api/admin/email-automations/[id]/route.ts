import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface StepInput { subject: string; templateId?: string; html?: string; delayMinutes?: number }

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const automation = await prisma.emailAutomation.findUnique({ where: { id } });
  if (!automation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const steps = await prisma.emailAutomationStep.findMany({ where: { automationId: id }, orderBy: { stepOrder: "asc" } });
  return NextResponse.json({ automation, steps });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await request.json();

  // Quick active toggle only.
  if (typeof b.active === "boolean" && !b.steps && !b.name) {
    const automation = await prisma.emailAutomation.update({ where: { id }, data: { active: b.active } });
    return NextResponse.json({ success: true, automation });
  }

  const types: string[] = b.trigger?.types || [];
  const steps: StepInput[] = b.steps || [];
  if (steps.length === 0 || steps.some((s) => !s.subject?.trim() || (!s.templateId && !s.html?.trim()))) {
    return NextResponse.json({ error: "Each step needs a subject and a template or content." }, { status: 400 });
  }
  await prisma.emailAutomation.update({
    where: { id },
    data: { ...(b.name ? { name: b.name.trim() } : {}), ...(types.length ? { trigger: { types } } : {}), ...(typeof b.active === "boolean" ? { active: b.active } : {}) },
  });
  // Replace steps.
  await prisma.emailAutomationStep.deleteMany({ where: { automationId: id } });
  await prisma.emailAutomationStep.createMany({
    data: steps.map((s, i) => ({ automationId: id, stepOrder: i, subject: s.subject.trim(), templateId: s.templateId || null, html: s.html || null, delayMinutes: s.delayMinutes || 0 })),
  });
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.emailAutomationStep.deleteMany({ where: { automationId: id } });
  await prisma.emailAutomationRecipient.deleteMany({ where: { automationId: id } });
  await prisma.emailAutomation.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
