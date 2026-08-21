// Estimate how many homes sit inside a drawn polygon by counting residential
// building footprints from OpenStreetMap (Overpass API). This is the best free
// signal available for an arbitrary shape; coverage is strong in mapped suburbs
// like the Inland Empire. It's an estimate, not a parcel-exact count.

type Ring = [number, number][]; // [lng, lat] points

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// Residential-ish building values (includes generic "yes", the most common tag
// on single-family homes). Excludes garages/sheds/commercial/etc.
const RESIDENTIAL = "house|detached|semidetached_house|terrace|residential|apartments|bungalow|dormitory|yes";

function polyString(ring: Ring): string {
  // Overpass wants "lat lon lat lon …". Our ring is [lng, lat].
  return ring.map(([lng, lat]) => `${lat} ${lng}`).join(" ");
}

export function ringIsValid(ring: unknown): ring is Ring {
  return (
    Array.isArray(ring) &&
    ring.length >= 3 &&
    ring.every((p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
  );
}

/** Approximate area of a lng/lat ring in acres (equirectangular, fine at city scale). */
export function ringAcres(ring: Ring): number {
  if (ring.length < 3) return 0;
  const R = 6_371_000; // m
  const latAvg = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * (Math.PI / 180);
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos(latAvg);
  let area2 = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    area2 += (x1 * mPerDegLng) * (y2 * mPerDegLat) - (x2 * mPerDegLng) * (y1 * mPerDegLat);
  }
  const m2 = Math.abs(area2) / 2;
  void R;
  return m2 / 4046.8564224; // m² → acres
}

export async function countHomesInPolygon(ring: Ring): Promise<{ count: number } | { error: string }> {
  if (!ringIsValid(ring)) return { error: "Invalid area." };
  const poly = polyString(ring);
  const query = `[out:json][timeout:25];(way["building"~"${RESIDENTIAL}",i](poly:"${poly}");relation["building"~"${RESIDENTIAL}",i](poly:"${poly}"););out count;`;

  for (const url of ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 27_000);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "DooGoodScoopers-Canvassing/1.0 (admin territory planner)",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json().catch(() => null);
      const el = data?.elements?.find((e: { type?: string }) => e?.type === "count");
      const total = el?.tags?.total ?? el?.count?.total;
      if (total != null) return { count: parseInt(String(total), 10) || 0 };
    } catch {
      // try the next endpoint
    }
  }
  return { error: "Couldn't reach the map data service. Try again in a moment." };
}
