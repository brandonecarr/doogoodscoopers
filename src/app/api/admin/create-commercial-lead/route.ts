import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncContactToQuo } from "@/lib/quo";
import type { LeadStatus } from "@/types/leads";

/**
 * Manual commercial lead — an HOA, complex or business the owner spoke to
 * directly. Separate from /api/admin/create-lead on purpose: commercial leads
 * are never consolidated with residential ones by phone (see lead-duplicates),
 * and the record has a different shape (property, not dogs and gates).
 */
interface Body {
  contactName: string; propertyName: string; phone: string; email?: string;
  city: string; state?: string; zipCode: string; status?: LeadStatus; inquiry?: string;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  let b: Body;
  try { b = await request.json(); } catch { return NextResponse.json({ success: false, error: "Bad payload" }, { status: 400 }); }

  const req = { contactName: b.contactName, propertyName: b.propertyName, phone: b.phone, city: b.city, zipCode: b.zipCode };
  const missing = Object.entries(req).filter(([, v]) => !String(v || "").trim()).map(([k]) => k);
  if (missing.length) return NextResponse.json({ success: false, error: `Missing: ${missing.join(", ")}` }, { status: 400 });

  try {
    const lead = await prisma.commercialLead.create({
      data: {
        contactName: b.contactName.trim(), propertyName: b.propertyName.trim(), phone: b.phone.trim(),
        email: (b.email || "").trim(), city: b.city.trim(), state: (b.state || "CA").trim().toUpperCase() || "CA",
        zipCode: b.zipCode.trim(), status: b.status || "NEW", inquiry: (b.inquiry || "").trim() || null,
      },
    });
    await prisma.activityLog.create({
      data: { action: "LEAD_CREATED", leadType: "COMMERCIAL", leadId: lead.id, details: { createdManually: true }, adminEmail: session.email },
    });
    syncContactToQuo({
      externalId: `commerciallead:${lead.id}`, firstName: lead.contactName, email: lead.email || null,
      phone: lead.phone, company: lead.propertyName, source: "DooGoodScoopers Manual",
    });
    return NextResponse.json({ success: true, id: lead.id });
  } catch (e) {
    console.error("[create-commercial-lead]", e);
    return NextResponse.json({ success: false, error: "Failed to create lead" }, { status: 500 });
  }
}
