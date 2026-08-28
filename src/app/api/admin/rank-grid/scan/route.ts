import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { runRankScan } from "@/lib/rank-grid";

// Runs one grid scan. Each grid point is a paid Google Places call, so this is
// only ever triggered by hand from the admin — never on a schedule.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  const cityId = String(b.cityId ?? "");
  const keyword = String(b.keyword ?? "").trim();
  const businessName = String(b.businessName ?? "").trim();
  if (!cityId || !keyword || !businessName) {
    return NextResponse.json({ error: "cityId, keyword and businessName are required" }, { status: 400 });
  }

  const result = await runRankScan({ cityId, keyword, businessName });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });

  const scan = await prisma.rankGridScan.findUnique({ where: { id: result.scanId! } });
  const points = await prisma.rankGridPoint.findMany({ where: { scanId: result.scanId! } });
  return NextResponse.json({ scan, points });
}

// Latest scan for a city (or a specific scan), for redrawing the map.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = new URL(request.url).searchParams;
  const scanId = sp.get("scanId");
  const cityId = sp.get("cityId");

  const scan = scanId
    ? await prisma.rankGridScan.findUnique({ where: { id: scanId } })
    : cityId
      ? await prisma.rankGridScan.findFirst({ where: { cityId }, orderBy: { createdAt: "desc" } })
      : null;
  if (!scan) return NextResponse.json({ scan: null, points: [] });

  const points = await prisma.rankGridPoint.findMany({ where: { scanId: scan.id } });
  return NextResponse.json({ scan, points });
}
