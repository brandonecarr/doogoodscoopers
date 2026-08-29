import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { testProvider, activeProvider } from "@/lib/rank-grid";

// A single lookup from one coordinate — proves the data source can see the
// business before a full grid is paid for.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  const keyword = String(b.keyword ?? "").trim();
  const businessName = String(b.businessName ?? "").trim();
  const cityId = String(b.cityId ?? "");
  if (!keyword || !businessName || !cityId) {
    return NextResponse.json({ error: "cityId, keyword and businessName are required" }, { status: 400 });
  }

  const city = await prisma.rankGridCity.findUnique({ where: { id: cityId } });
  if (!city) return NextResponse.json({ error: "City not found" }, { status: 404 });

  const result = await testProvider({
    keyword, businessName, lat: city.lat, lng: city.lng,
    place: city.name.split(",").slice(0, 2).join(", ").trim(),
  });
  return NextResponse.json(result);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ provider: activeProvider() });
}
