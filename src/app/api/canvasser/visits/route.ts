import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCanvasserSession } from "@/lib/canvasser-auth";
import { reverseGeocode, normalizeZip } from "@/lib/geo/zipgeo";

// Canvasser map pins. Every handler is gated to a canvasser session and scoped
// to the caller's own rows (canvasserId = the Supabase user id). Writes are
// idempotent upserts on the client-generated `clientKey`, so an offline queue
// can safely replay them without creating duplicates.

export const dynamic = "force-dynamic";
export const maxDuration = 30; // POST reverse-geocodes on first drop

const STATUSES = new Set(["NOT_HOME", "NOT_INTERESTED", "CALLBACK", "INTERESTED", "LEAD", "DO_NOT_KNOCK"]);

export async function GET() {
  const user = await getCanvasserSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const visits = await prisma.canvassVisit.findMany({
    where: { canvasserId: user.id },
    orderBy: { createdAt: "desc" },
    take: 3000,
  });
  return NextResponse.json({ visits });
}

export async function POST(request: Request) {
  const user = await getCanvasserSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { clientKey, lat, lng } = body as { clientKey?: string; lat?: number; lng?: number };
  if (!clientKey || typeof clientKey !== "string") {
    return NextResponse.json({ error: "clientKey is required" }, { status: 400 });
  }
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  // One pin per home. The client guards this too, but the offline queue and a
  // second device can both replay a fresh create, so the rule is enforced here.
  // Only NEW pins are checked — replaying an existing clientKey is an update.
  const preExisting = await prisma.canvassVisit.findUnique({ where: { clientKey }, select: { id: true } });
  if (!preExisting) {
    const box = 0.0005; // ~55 m — a generous prefilter before exact distance
    const near = await prisma.canvassVisit.findMany({
      where: { lat: { gte: lat - box, lte: lat + box }, lng: { gte: lng - box, lte: lng + box } },
      select: { clientKey: true, lat: true, lng: true, address: true, canvasserName: true, status: true },
      take: 50,
    });
    const mLat = 111_320, mLng = 111_320 * Math.cos(lat * (Math.PI / 180));
    const dupe = near.find((v) => Math.hypot((v.lng - lng) * mLng, (v.lat - lat) * mLat) <= 18);
    if (dupe) {
      return NextResponse.json(
        {
          error: "duplicate_home",
          message: dupe.canvasserName
            ? `${dupe.address || "This home"} already has a pin from ${dupe.canvasserName}.`
            : `${dupe.address || "This home"} already has a pin.`,
          existing: dupe,
        },
        { status: 409 }
      );
    }
  }

  // Ownership guard: never let one canvasser overwrite another's pin.
  const existing = await prisma.canvassVisit.findUnique({ where: { clientKey } });
  if (existing && existing.canvasserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = typeof body.status === "string" && STATUSES.has(body.status) ? body.status : "NOT_HOME";
  const notes = typeof body.notes === "string" ? body.notes : null;

  // Fill the street address from the pin. `regeocode` (sent when a pin is moved)
  // forces a fresh lookup that overwrites the old address; otherwise we only
  // geocode when nothing is set yet, so a manually-edited address is preserved.
  const regeocode = body.regeocode === true;
  let address: string | null = typeof body.address === "string" ? body.address : null;
  let city: string | null = typeof body.city === "string" ? body.city : null;
  let zipCode: string | null = normalizeZip(body.zipCode) ?? (typeof body.zipCode === "string" ? body.zipCode : null);
  if (regeocode || (!address && !existing?.address)) {
    const hit = await reverseGeocode(lat, lng);
    if (hit) {
      address = hit.address || null;
      city = city ?? hit.city;
      zipCode = zipCode ?? normalizeZip(hit.zip);
    }
  }

  const visit = await prisma.canvassVisit.upsert({
    where: { clientKey },
    create: {
      clientKey, canvasserId: user.id, canvasserName: user.name, orgId: "",
      lat, lng, address, city, zipCode, status, notes,
    },
    update: {
      lat, lng, status, notes,
      // keep the first resolved address; only backfill if we now have one
      ...(address ? { address } : {}),
      ...(city ? { city } : {}),
      ...(zipCode ? { zipCode } : {}),
    },
  });

  return NextResponse.json({ visit });
}

// Remove a pin. Scoped to the owner and idempotent (deleting a pin that never
// synced is a harmless no-op), so it's safe to replay from the offline queue.
export async function DELETE(request: Request) {
  const user = await getCanvasserSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clientKey } = await request.json().catch(() => ({}));
  if (!clientKey || typeof clientKey !== "string") {
    return NextResponse.json({ error: "clientKey is required" }, { status: 400 });
  }
  await prisma.canvassVisit.deleteMany({ where: { clientKey, canvasserId: user.id } });
  return NextResponse.json({ ok: true });
}
