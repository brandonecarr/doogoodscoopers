import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncContactToQuo } from "@/lib/quo";
import { PROSPECT_TYPE_LABEL, type ProspectType } from "@/lib/commercial-prospects";

/** A prospect you reached becomes a commercial lead. The prospect stays, marked CONVERTED and linked. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const p = await prisma.commercialProspect.findUnique({ where: { id } });
  if (!p) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  if (p.convertedLeadId) return NextResponse.json({ success: true, id: p.convertedLeadId, already: true });
  if (!p.phone && !p.email) return NextResponse.json({ success: false, error: "Add a phone or email before converting" }, { status: 400 });
  try {
    const typeLabel = PROSPECT_TYPE_LABEL[(p.propertyType as ProspectType)] || p.propertyType;
    const lead = await prisma.commercialLead.create({ data: {
      contactName: p.contactName || "Unknown", propertyName: p.propertyName, phone: p.phone || "", email: p.email || "",
      city: p.city, state: p.state, zipCode: p.zipCode, status: "CONTACTED",
      inquiry: [`From the call list — ${typeLabel}${p.units ? `, ${p.units} units` : ""}${p.source ? ` (${p.source})` : ""}`, p.notes].filter(Boolean).join("\n\n") } });
    await prisma.commercialProspect.update({ where: { id }, data: { status: "CONVERTED", convertedLeadId: lead.id } });
    await prisma.activityLog.create({ data: { action: "LEAD_CREATED", leadType: "COMMERCIAL", leadId: lead.id, details: { fromProspect: id, createdManually: true }, adminEmail: session.email } });
    syncContactToQuo({ externalId: `commerciallead:${lead.id}`, firstName: lead.contactName, email: lead.email || null, phone: lead.phone, company: lead.propertyName, source: "DooGoodScoopers Call List" });
    return NextResponse.json({ success: true, id: lead.id });
  } catch (e) {
    console.error("[commercial-prospect convert]", e);
    return NextResponse.json({ success: false, error: "Could not convert" }, { status: 500 });
  }
}
