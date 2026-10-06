import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ensureResumeCode, regenerateResumeCode, resumeLinkForLead } from "@/lib/quote-recovery";

// PATCH { action: "create" | "regenerate" | "disable" | "enable" } → manage a lead's resume link.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { action } = await request.json().catch(() => ({}));
  const lead = await prisma.quoteLead.findUnique({ where: { id }, select: { id: true } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "regenerate") await regenerateResumeCode(id); // the old link stops working immediately
  else if (action === "disable") await prisma.quoteLead.update({ where: { id }, data: { resumeDisabled: true } });
  else if (action === "enable") await prisma.quoteLead.update({ where: { id }, data: { resumeDisabled: false } });
  else if (action === "create") { if (!(await ensureResumeCode(id))) return NextResponse.json({ error: "Only Sweep&Go quote leads can be resumed on the website." }, { status: 400 }); }
  else return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const updated = await prisma.quoteLead.findUnique({ where: { id }, select: { resumeCode: true, resumeDisabled: true } });
  return NextResponse.json({ ok: true, resumeCode: updated?.resumeCode ?? null, resumeDisabled: updated?.resumeDisabled ?? false, link: await resumeLinkForLead(id) });
}
