import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Parameter probe for the rank-grid data source.
 *
 * A Fontana scan returned "DoodyCalls of Central Suffolk" (New York) and a
 * Polish pet shop, which proves the coordinates are not binding the search —
 * the grid was measuring against a global result set, not a local one.
 *
 * Rather than guess which parameter shape Scrappa actually honours, this runs
 * several against ONE coordinate and reports what each returns, so the fix is
 * chosen on evidence. A handful of credits to avoid another wrong rebuild.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Variant { label: string; url: string }

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.SCRAPPA_API_KEY;
  if (!key) return NextResponse.json({ error: "SCRAPPA_API_KEY not set" }, { status: 400 });

  const b = await request.json().catch(() => ({}));
  const cityId = String(b.cityId ?? "");
  const keyword = String(b.keyword ?? "dog poop removal").trim();
  const city = cityId ? await prisma.rankGridCity.findUnique({ where: { id: cityId } }) : null;
  if (!city) return NextResponse.json({ error: "City not found" }, { status: 404 });

  const lat = city.lat.toFixed(6);
  const lon = city.lng.toFixed(6);
  const place = city.name.split(",").slice(0, 2).join(", ").trim();
  const q = encodeURIComponent(keyword);
  const ADV = "https://scrappa.co/api/maps/advanced-search";
  const SIMPLE = "https://scrappa.co/api/maps/simple-search";

  const variants: Variant[] = [
    { label: "A · current (lat/lon, zoom 14)", url: `${ADV}?query=${q}&lat=${lat}&lon=${lon}&zoom=14&limit=20&hl=en&gl=us` },
    { label: "B · wider zoom 11", url: `${ADV}?query=${q}&lat=${lat}&lon=${lon}&zoom=11&limit=20&hl=en&gl=us` },
    { label: "C · lng spelling", url: `${ADV}?query=${q}&lat=${lat}&lng=${lon}&zoom=14&limit=20&hl=en&gl=us` },
    { label: "D · place name in query", url: `${ADV}?query=${encodeURIComponent(`${keyword} ${place}`)}&lat=${lat}&lon=${lon}&zoom=14&limit=20&hl=en&gl=us` },
    { label: "E · simple-search, place in query", url: `${SIMPLE}?query=${encodeURIComponent(`${keyword} ${place}`)}&limit=20` },
  ];

  const out = [];
  for (const v of variants) {
    try {
      const res = await fetch(v.url, { headers: { "x-api-key": key }, cache: "no-store" });
      const text = await res.text();
      let names: string[] = [];
      let rowCount = 0;
      try {
        const j = JSON.parse(text);
        const rows = (j?.items ?? j?.results ?? j?.data ?? []) as { name?: string; title?: string; address?: string; full_address?: string }[];
        rowCount = Array.isArray(rows) ? rows.length : 0;
        names = (Array.isArray(rows) ? rows : []).slice(0, 5).map(
          (r) => `${r.name || r.title || "?"}${r.address || r.full_address ? ` — ${r.address || r.full_address}` : ""}`
        );
      } catch {
        names = [text.replace(/\s+/g, " ").slice(0, 200)];
      }
      out.push({ variant: v.label, status: res.status, rowCount, sample: names });
    } catch (e) {
      out.push({ variant: v.label, status: 0, rowCount: 0, sample: [e instanceof Error ? e.message : "failed"] });
    }
  }

  return NextResponse.json({
    city: city.name,
    coordinate: `${lat},${lon}`,
    keyword,
    note: "The winning variant is whichever returns businesses actually IN or NEAR this city.",
    variants: out,
  });
}
