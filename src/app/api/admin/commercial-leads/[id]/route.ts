import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { LeadStatus } from "@/types/leads";

/** Full-field edit of a commercial lead (the Edit page). Status/notes/grade quick edits stay on update-lead. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  let b: { contactName?: string; propertyName?: string; phone?: string; email?: string; city?: string; state?: string; zipCode?: string; status?: LeadStatus; inquiry?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ success: false, error: "Bad payload" }, { status: 400 }); }
  const req = { contactName: b.contactName, propertyName: b.propertyName, phone: b.phone, city: b.city, zipCode: b.zipCode };
  const missing = Object.entries(req).filter(([, v]) => !String(v || "").trim()).map(([k]) => k);
  if (missing.length) return NextResponse.json({ success: false, error: `Missing: ${missing.join(", ")}` }, { status: 400 });
  try {
    const lead = await prisma.commercialLead.update({
      where: { id },
      data: {
        contactName: b.contactName!.trim(), propertyName: b.propertyName!.trim(), phone: b.phone!.trim(),
        email: (b.email || "").trim(), city: b.city!.trim(), state: ((b.state || "CA").trim().toUpperCase() || "CA"),
        zipCode: b.zipCode!.trim(), ...(b.status ? { status: b.status } : {}), inquiry: (b.inquiry || "").trim() || null,
      },
    });
    await prisma.activityLog.create({
      data: { action: "LEAD_UPDATED", leadType: "COMMERCIAL", leadId: id, details: { editedFields: Object.keys(b) }, adminEmail: session.email },
    });
    return NextResponse.json({ success: true, id: lead.id });
  } catch (e) {
    console.error("[commercial lead edit]", e);
    return NextResponse.json({ success: false, error: "Could not save changes" }, { status: 500 });
  }
}
