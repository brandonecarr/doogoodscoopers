import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Active customers with a PRECISE (address-verified) location, for the map
// overlay on the territory planner. Only `geoPrecise` customers are returned so
// a pin is never drawn at a ZIP centroid; the rest are counted as `hiddenCount`.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [rows, total, precise] = await Promise.all([
    prisma.sweepandgoCustomer.findMany({
      where: { active: true, geoPrecise: true, lat: { not: null }, lng: { not: null } },
      select: { id: true, firstName: true, lastName: true, address: true, zipCode: true, lat: true, lng: true },
      take: 5000,
    }),
    prisma.sweepandgoCustomer.count({ where: { active: true } }),
    prisma.sweepandgoCustomer.count({ where: { active: true, geoPrecise: true, lat: { not: null }, lng: { not: null } } }),
  ]);

  const points = rows.map((c) => ({
    id: c.id,
    lat: c.lat as number,
    lng: c.lng as number,
    name: [c.firstName, c.lastName].filter(Boolean).join(" ") || "Customer",
    address: [c.address, c.zipCode].filter(Boolean).join(", "),
  }));

  return NextResponse.json({ points, total, shown: precise, hiddenCount: Math.max(0, total - precise) });
}
