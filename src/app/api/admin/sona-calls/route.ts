import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { LeadSource } from "@prisma/client";
import { defaultSonaTask, sonaLeadInfo, sonaSettings, startSonaCall, toE164 } from "@/lib/sona-calls";
import { quoMcpStatus } from "@/lib/quo-mcp";

const TYPES = new Set<string>(["QUOTE_FORM", "AD_LEAD", "COMMERCIAL", "OUT_OF_AREA"]);

/** GET ?leadType&leadId → the lead's Sona calls + what the confirm panel needs (prefilled task, numbers, warnings). */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const leadType = q.get("leadType") || "", leadId = q.get("leadId") || "";
  if (!TYPES.has(leadType) || !leadId) return NextResponse.json({ error: "leadType and leadId required" }, { status: 400 });
  const [calls, lead, status, settings] = await Promise.all([
    prisma.sonaCall.findMany({ where: { leadType: leadType as LeadSource, leadId }, orderBy: { createdAt: "desc" }, take: 20 }),
    sonaLeadInfo(leadType as LeadSource, leadId),
    quoMcpStatus(),
    sonaSettings(),
  ]);
  const task = q.get("task") === "1" ? await defaultSonaTask(leadType as LeadSource, leadId) : null;
  return NextResponse.json({
    calls, task, connected: status.connected, fromNumber: settings.fromNumber, maxDurationSeconds: settings.maxDurationSeconds,
    toNumber: toE164(lead?.phone) ?? null, marketingAllowed: lead?.marketingAllowed ?? null, leadName: lead?.name ?? null,
  });
}

/** POST { leadType, leadId, task, voicemail?, voicemailMessage?, overrideConsent? } → start the call (this IS the confirmation). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!TYPES.has(body.leadType) || !body.leadId) return NextResponse.json({ error: "leadType and leadId required" }, { status: 400 });
  const r = await startSonaCall({
    leadType: body.leadType, leadId: String(body.leadId), task: String(body.task || ""), byEmail: session.email,
    voicemail: body.voicemail === "leave-message" ? "leave-message" : "hang-up", voicemailMessage: body.voicemailMessage ? String(body.voicemailMessage) : null,
    maxDurationSeconds: Number(body.maxDurationSeconds) || undefined, overrideConsent: !!body.overrideConsent,
  });
  if (!r.ok) return NextResponse.json({ error: r.error, code: r.code }, { status: r.code === "consent" ? 409 : 400 });
  const call = await prisma.sonaCall.findUnique({ where: { id: r.id } });
  return NextResponse.json({ ok: true, call });
}
