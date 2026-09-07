import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/**
 * Satellite image of the property with the traced service areas drawn on it,
 * for the proposal PDF. GET ?shapes=<JSON lng/lat rings>&w=&h=
 * Mapbox Static Images does the rendering; we proxy so the token stays here
 * and the PDF renderer (in the browser) gets a same-origin image.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return NextResponse.json({ error: "Mapbox token not configured" }, { status: 400 });
  const sp = request.nextUrl.searchParams;
  let rings: [number, number][][] = [];
  try { rings = JSON.parse(sp.get("shapes") || "[]"); } catch { rings = []; }
  rings = rings.filter((r) => Array.isArray(r) && r.length >= 3);
  if (rings.length === 0) return NextResponse.json({ error: "No shapes" }, { status: 400 });
  const w = Math.min(1280, Math.max(200, parseInt(sp.get("w") || "934", 10) || 934));
  const h = Math.min(1280, Math.max(200, parseInt(sp.get("h") || "630", 10) || 630));

  // Six decimals ≈ 10 cm; keeps the overlay URL well under Mapbox's limit.
  const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
  const fc = {
    type: "FeatureCollection",
    features: rings.map((ring) => ({
      type: "Feature",
      properties: { fill: "#008EFF", "fill-opacity": 0.28, stroke: "#008EFF", "stroke-width": 3, "stroke-opacity": 0.95 },
      geometry: { type: "Polygon", coordinates: [[...ring.map(([x, y]) => [r6(x), r6(y)]), [r6(ring[0][0]), r6(ring[0][1])]]] },
    })),
  };
  const overlay = `geojson(${encodeURIComponent(JSON.stringify(fc))})`;
  const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${overlay}/auto/${w}x${h}@2x?padding=60&attribution=false&logo=false&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json({ error: `Mapbox ${res.status}: ${text.slice(0, 200)}` }, { status: 502 });
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return new NextResponse(buf, { headers: { "Content-Type": res.headers.get("content-type") || "image/png", "Cache-Control": "private, max-age=300" } });
}
