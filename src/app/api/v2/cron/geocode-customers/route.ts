import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isMapboxConfigured, geocodeAddress } from "@/lib/geo/zipgeo";
import { getSession } from "@/lib/auth";

// Pre-geocode customer addresses so the customers Map view loads instantly and
// the territory-planner overlay pins are exact. Bounded batch per run.
// Auth: the Vercel cron Bearer token, OR a logged-in admin (to force a run).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authed =
    (cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) ||
    (await getSession());
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMapboxConfigured()) {
    return NextResponse.json({ success: false, error: "MAPBOX token not set" }, { status: 200 });
  }

  // Re-geocode anything not yet precision-verified — this backfills both new
  // customers AND older ones still sitting on a ZIP centroid.
  const pending = await prisma.sweepandgoCustomer.findMany({
    where: { active: true, geoPrecise: null, address: { not: null } },
    select: { id: true, address: true, zipCode: true },
    take: 40,
  });

  let geocoded = 0, precise = 0;
  for (let i = 0; i < pending.length; i += 8) {
    const chunk = pending.slice(i, i + 8);
    await Promise.all(chunk.map(async (c) => {
      const p = await geocodeAddress(c.address, c.zipCode);
      if (p) {
        await prisma.sweepandgoCustomer.update({
          where: { id: c.id },
          data: { lat: p.lat, lng: p.lng, geoPrecise: p.precise, geoAccuracy: p.accuracy ?? null },
        }).catch(() => {});
        geocoded++;
        if (p.precise) precise++;
      }
    }));
  }

  const remaining = await prisma.sweepandgoCustomer.count({
    where: { active: true, geoPrecise: null, address: { not: null } },
  });
  return NextResponse.json({ success: true, geocoded, precise, remaining });
}
