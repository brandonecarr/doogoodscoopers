import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { MAX_GRID } from "@/lib/rank-grid";

export const dynamic = "force-dynamic";

/** Forward-geocode a city name with Mapbox (already used across the app). */
async function geocodeCity(name: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(name)}.json` +
    `?access_token=${encodeURIComponent(token)}&country=us&types=place,locality,postcode&limit=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = (await res.json()) as { features?: { center: [number, number]; place_name: string }[] };
    const f = j.features?.[0];
    if (!f) return null;
    return { lng: f.center[0], lat: f.center[1], label: f.place_name };
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cities = await prisma.rankGridCity.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ cities });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));

  const name = String(b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Enter a city or ZIP" }, { status: 400 });

  const hit = await geocodeCity(name);
  if (!hit) return NextResponse.json({ error: `Couldn't find "${name}" on the map.` }, { status: 400 });

  const gridSize = Math.max(3, Math.min(Number(b.gridSize) || 7, MAX_GRID));
  const spacingKm = Math.max(0.25, Math.min(Number(b.spacingKm) || 2, 25));

  const city = await prisma.rankGridCity.create({
    data: { name: hit.label.split(",").slice(0, 2).join(",").trim(), lat: hit.lat, lng: hit.lng, gridSize, spacingKm },
  });
  return NextResponse.json({ city });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (b.gridSize !== undefined) data.gridSize = Math.max(3, Math.min(Number(b.gridSize) || 7, MAX_GRID));
  if (b.spacingKm !== undefined) data.spacingKm = Math.max(0.25, Math.min(Number(b.spacingKm) || 2, 25));
  if (b.active !== undefined) data.active = !!b.active;
  const city = await prisma.rankGridCity.update({ where: { id }, data });
  return NextResponse.json({ city });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const scans = await prisma.rankGridScan.findMany({ where: { cityId: id }, select: { id: true } });
  if (scans.length) {
    await prisma.rankGridPoint.deleteMany({ where: { scanId: { in: scans.map((s) => s.id) } } });
    await prisma.rankGridScan.deleteMany({ where: { cityId: id } });
  }
  await prisma.rankGridCity.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
