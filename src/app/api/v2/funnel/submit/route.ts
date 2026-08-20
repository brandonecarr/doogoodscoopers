import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { captureQuoteLead, captureOutOfAreaLead } from "@/lib/lead-capture";
import { sendLeadEvent, isMetaCapiConfigured } from "@/lib/meta-capi";

// Public: a funnel's final submit. Creates a QuoteLead (in-area) or an
// OutOfAreaLead (out-of-area) via the shared lead-capture lib, ties it to the
// session, and logs the conversion. Never rebuilds payment — booking handoff is
// a client-side CTA to the Sweep&Go onboarding URL.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}));
  const a = (b.answers && typeof b.answers === "object" ? b.answers : {}) as Record<string, string>;

  if (!a.phone || !a.zipCode) {
    return NextResponse.json({ error: "phone and zipCode are required" }, { status: 400 });
  }
  const inArea = String(a.inServiceArea) !== "false"; // default in-area unless explicitly flagged out

  let leadId: string;
  let leadType: "quote" | "outofarea";
  try {
    if (inArea) {
      if (!a.firstName) return NextResponse.json({ error: "name is required" }, { status: 400 });
      leadId = await captureQuoteLead({
        firstName: a.firstName, lastName: a.lastName, email: a.email, phone: a.phone,
        address: a.address, zipCode: a.zipCode, numberOfDogs: a.numberOfDogs,
        frequency: a.frequency, lastCleaned: a.lastCleaned, igTracking: a.igTracking,
        lastStep: "Funnel", sourceLabel: "DooGoodScoopers Funnel",
      });
      leadType = "quote";
    } else {
      leadId = await captureOutOfAreaLead({
        firstName: a.firstName, lastName: a.lastName, email: a.email, phone: a.phone, zipCode: a.zipCode,
      });
      leadType = "outofarea";
    }
  } catch (e) {
    console.error("[funnel/submit] lead capture failed:", e);
    return NextResponse.json({ error: "Could not save your details. Please try again." }, { status: 500 });
  }

  if (b.sessionId) {
    await prisma.funnelSession.update({
      where: { id: String(b.sessionId) },
      data: { leadId, leadType, completedAt: new Date() },
    }).catch(() => {});
    await prisma.funnelEvent.create({
      data: {
        sessionId: String(b.sessionId), funnelId: String(b.funnelId || ""),
        variant: b.variant === "B" ? "B" : "A", step: String(b.step || "submit"),
        type: "submit", payload: { leadType },
      },
    }).catch(() => {});
  }

  // Server-side Meta CAPI Lead (dedupes with the browser pixel via eventId).
  if (isMetaCapiConfigured() && b.eventId) {
    const attr = (b.attribution && typeof b.attribution === "object" ? b.attribution : {}) as Record<string, string>;
    let fbc = attr.fbc || null;
    if (!fbc && attr.fbclid) fbc = `fb.1.${Date.now()}.${attr.fbclid}`;
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    await sendLeadEvent({
      eventId: String(b.eventId),
      eventSourceUrl: b.pageUrl ? String(b.pageUrl) : undefined,
      email: a.email, phone: a.phone, firstName: a.firstName, lastName: a.lastName,
      zip: a.zipCode, city: a.city, fbp: attr.fbp || null, fbc,
      clientIp, userAgent: request.headers.get("user-agent"),
      value: typeof b.value === "number" ? b.value : undefined, currency: "USD",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, leadId, leadType });
}
