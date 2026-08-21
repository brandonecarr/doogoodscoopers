import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { countHomesInPolygon, ringAcres, ringIsValid } from "@/lib/geo/home-count";

// Count the (estimated) homes inside a drawn polygon, for the territory planner.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const ring = body?.polygon;
  if (!ringIsValid(ring)) return NextResponse.json({ error: "Draw an area with at least 3 points." }, { status: 400 });

  const result = await countHomesInPolygon(ring);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 502 });

  return NextResponse.json({ count: result.count, areaAcres: Math.round(ringAcres(ring) * 10) / 10 });
}
