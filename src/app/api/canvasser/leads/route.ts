import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCanvasserSession } from "@/lib/canvasser-auth";
import { syncContactToQuo } from "@/lib/quo";
import { normalizeZip } from "@/lib/geo/zipgeo";

// Canvasser leads = the subset of visits a rep marks as a lead. Gated to a
// canvasser session and scoped to the caller's own rows. Idempotent upsert on
// `clientKey` (offline-safe). Syncs a Quo contact but is deliberately NOT wired
// into any existing drip campaign (canvasser is its own source).

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCanvasserSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const leads = await prisma.canvasserLead.findMany({
    where: { canvasserId: user.id },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  return NextResponse.json({ leads });
}

export async function POST(request: Request) {
  const user = await getCanvasserSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { clientKey, visitClientKey } = body as { clientKey?: string; visitClientKey?: string };
  if (!clientKey || typeof clientKey !== "string") {
    return NextResponse.json({ error: "clientKey is required" }, { status: 400 });
  }

  const existing = await prisma.canvasserLead.findUnique({ where: { clientKey } });
  if (existing && existing.canvasserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const data = {
    firstName: str(body.firstName),
    lastName: str(body.lastName),
    email: str(body.email),
    phone: str(body.phone),
    address: str(body.address),
    city: str(body.city),
    zipCode: normalizeZip(body.zipCode) ?? str(body.zipCode),
    notes: str(body.notes),
  };

  const lead = await prisma.canvasserLead.upsert({
    where: { clientKey },
    create: {
      clientKey, canvasserId: user.id, canvasserName: user.name, orgId: "",
      visitId: str(body.visitId), ...data,
    },
    update: { ...data },
  });

  // Link the originating pin and flip it to LEAD (best-effort, owner-scoped).
  if (visitClientKey && typeof visitClientKey === "string") {
    await prisma.canvassVisit.updateMany({
      where: { clientKey: visitClientKey, canvasserId: user.id },
      data: { status: "LEAD", canvasserLeadId: lead.id },
    });
  }

  // Push into Quo like other prospects (only when we have a phone).
  if (lead.phone) {
    syncContactToQuo({
      externalId: `canvasserlead:${lead.id}`,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      source: "DooGoodScoopers Canvasser",
    });
  }

  return NextResponse.json({ lead });
}
