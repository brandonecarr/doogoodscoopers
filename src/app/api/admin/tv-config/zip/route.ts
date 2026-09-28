import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** ZIP → coordinates and place name, for the TV's weather section (from the ZipGeo table). */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const zip = (new URL(request.url).searchParams.get("zip") || "").trim().slice(0, 5);
  if (!/^\d{5}$/.test(zip)) return NextResponse.json({ error: "Enter a 5-digit ZIP code" }, { status: 400 });
  const row = await prisma.zipGeo.findUnique({ where: { zip } });
  if (!row) return NextResponse.json({ error: "That ZIP isn't in the service-area list" }, { status: 404 });
  // "Victorville, California 92392, United States" → "Victorville, CA"
  const city = row.place.split(",")[0]?.trim() || zip;
  const state = /California/i.test(row.place) ? "CA" : row.place.split(",")[1]?.trim().split(" ")[0] ?? "";
  return NextResponse.json({ zip, latitude: row.lat, longitude: row.lng, place: state ? `${city}, ${state}` : city });
}
