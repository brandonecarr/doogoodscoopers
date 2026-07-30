import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { consolidateByPhone, leadTypeMap, prospectUrl, type ProspectType } from "@/lib/lead-duplicates";

// POST { leadType: "quote"|"adlead", leadId } — the lead the user is viewing.
// Converges every prospect lead (quote + adlead) sharing its phone into one
// survivor (the richest record) and returns where that survivor lives so the
// client can navigate there if it moved.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const leadType = body.leadType as ProspectType;
  // Accept both the new { leadId } and the older { survivorId } field name.
  const leadId: string | undefined = body.leadId || body.survivorId;
  if ((leadType !== "quote" && leadType !== "adlead") || !leadId) {
    return NextResponse.json({ error: "leadType (quote|adlead) and leadId are required" }, { status: 400 });
  }

  const lead =
    leadType === "quote"
      ? await prisma.quoteLead.findUnique({ where: { id: leadId }, select: { phone: true } })
      : await prisma.adLead.findUnique({ where: { id: leadId }, select: { phone: true } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  try {
    const survivor = await consolidateByPhone(lead.phone);
    if (!survivor) return NextResponse.json({ error: "Nothing to merge" }, { status: 400 });

    await prisma.activityLog.create({
      data: {
        action: "LEADS_MERGED",
        leadType: leadTypeMap[survivor.type],
        leadId: survivor.id,
        details: { mergedFrom: `${leadType}:${leadId}`, survivor: `${survivor.type}:${survivor.id}` },
        adminEmail: session.email,
      },
    });

    return NextResponse.json({
      success: true,
      survivor: { type: survivor.type, id: survivor.id, url: prospectUrl(survivor.type, survivor.id) },
    });
  } catch (e) {
    console.error("Lead merge failed:", e);
    return NextResponse.json({ error: "Merge failed" }, { status: 500 });
  }
}
