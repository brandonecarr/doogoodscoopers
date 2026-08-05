import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isMapboxConfigured, geocodeAddress } from "@/lib/geo/zipgeo";

// Pre-geocode customer addresses so the customers Map view loads instantly.
// Processes a bounded batch each run; new customers get located within ~10 min.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isMapboxConfigured()) {
    return NextResponse.json({ success: false, error: "MAPBOX token not set" }, { status: 200 });
  }

  const pending = await prisma.sweepandgoCustomer.findMany({
    where: { active: true, OR: [{ lat: null }, { lng: null }], address: { not: null } },
    select: { id: true, address: true, zipCode: true },
    take: 40,
  });

  let geocoded = 0;
  for (let i = 0; i < pending.length; i += 8) {
    const chunk = pending.slice(i, i + 8);
    await Promise.all(chunk.map(async (c) => {
      const p = await geocodeAddress(c.address, c.zipCode);
      if (p) {
        await prisma.sweepandgoCustomer.update({ where: { id: c.id }, data: { lat: p.lat, lng: p.lng } }).catch(() => {});
        geocoded++;
      }
    }));
  }

  const remaining = await prisma.sweepandgoCustomer.count({
    where: { active: true, OR: [{ lat: null }, { lng: null }], address: { not: null } },
  });
  return NextResponse.json({ success: true, geocoded, remaining });
}
