import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const automations = await prisma.emailAutomation.findMany({ orderBy: { createdAt: "desc" } });
  // step + recipient counts
  const withCounts = await Promise.all(automations.map(async (a) => ({
    ...a,
    stepCount: await prisma.emailAutomationStep.count({ where: { automationId: a.id } }),
    activeCount: await prisma.emailAutomationRecipient.count({ where: { automationId: a.id, status: "ACTIVE" } }),
  })));
  return NextResponse.json({ automations: withCounts });
}

interface StepInput { subject: string; templateId?: string; html?: string; delayMinutes?: number }

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json();
  const types: string[] = b.trigger?.types || [];
  const steps: StepInput[] = b.steps || [];
  if (!b.name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (types.length === 0) return NextResponse.json({ error: "Pick at least one trigger." }, { status: 400 });
  if (steps.length === 0 || steps.some((s) => !s.subject?.trim() || (!s.templateId && !s.html?.trim()))) {
    return NextResponse.json({ error: "Each step needs a subject and a template or content." }, { status: 400 });
  }

  const automation = await prisma.emailAutomation.create({
    data: { name: b.name.trim(), trigger: { types }, active: b.active !== false, adminEmail: session.email },
  });
  await prisma.emailAutomationStep.createMany({
    data: steps.map((s, i) => ({ automationId: automation.id, stepOrder: i, subject: s.subject.trim(), templateId: s.templateId || null, html: s.html || null, delayMinutes: s.delayMinutes || 0 })),
  });
  return NextResponse.json({ success: true, automation });
}
