import prisma from "@/lib/prisma";

/**
 * Zip → coordinates for the Leads map.
 *
 * Mapbox has no bulk zip endpoint, so we geocode each distinct zip once and
 * cache the result in ZipGeo. Subsequent map loads (and any new leads that
 * share an already-seen zip) are then instant and cost nothing.
 */

export interface ZipPoint { lat: number; lng: number; place: string }

// Server-side geocoding works fine with a public (pk.) token, so a single
// NEXT_PUBLIC_MAPBOX_TOKEN covers both the map and this lookup. A dedicated
// server token (MAPBOX_TOKEN) takes precedence if set.
function mapboxToken(): string | undefined {
  return process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || undefined;
}

export function isMapboxConfigured(): boolean {
  return !!mapboxToken();
}

// US zips are 5 digits; strip ZIP+4 and stray characters.
export function normalizeZip(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = String(raw).match(/\d{5}/);
  return m ? m[0] : null;
}

async function geocodeZip(zip: string, token: string): Promise<ZipPoint | null> {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(zip)}.json` +
    `?country=US&types=postcode&limit=1&access_token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: { center?: [number, number]; place_name?: string }[] };
    const f = data.features?.[0];
    if (!f?.center || f.center.length < 2) return null;
    const [lng, lat] = f.center;
    return { lat, lng, place: f.place_name || "" };
  } catch {
    return null;
  }
}

/**
 * Geocode a full street address (for the customer map pin). Falls back to the
 * zip-code centroid when the address can't be resolved. Returns null only when
 * nothing at all resolves or Mapbox isn't configured.
 */
export async function geocodeAddress(address: string | null | undefined, zip: string | null | undefined): Promise<ZipPoint | null> {
  const token = mapboxToken();
  if (!token) return null;
  const zip5 = normalizeZip(zip);
  const query = [address?.trim(), zip5, "CA", "USA"].filter(Boolean).join(", ");
  if (address?.trim()) {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?country=US&types=address&limit=1&access_token=${encodeURIComponent(token)}`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as { features?: { center?: [number, number]; place_name?: string }[] };
        const f = data.features?.[0];
        if (f?.center && f.center.length >= 2) return { lat: f.center[1], lng: f.center[0], place: f.place_name || "" };
      }
    } catch { /* fall through to zip centroid */ }
  }
  // Fallback: zip centroid.
  if (zip5) {
    const map = await resolveZips([zip5]);
    return map.get(zip5) ?? null;
  }
  return null;
}

// Small concurrency cap so a batch of new zips doesn't hammer Mapbox at once.
async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Resolve coordinates for a set of zips, geocoding+caching any not seen before.
 * Returns a map of zip → point (missing entries couldn't be geocoded).
 */
export async function resolveZips(rawZips: (string | null | undefined)[]): Promise<Map<string, ZipPoint>> {
  const result = new Map<string, ZipPoint>();
  const token = mapboxToken();

  const zips = Array.from(
    new Set(rawZips.map(normalizeZip).filter((z): z is string => z !== null)),
  );
  if (zips.length === 0) return result;

  // Cached hits first.
  const cached = await prisma.zipGeo.findMany({ where: { zip: { in: zips } } });
  for (const c of cached) result.set(c.zip, { lat: c.lat, lng: c.lng, place: c.place });

  const missing = zips.filter((z) => !result.has(z));
  if (missing.length === 0 || !token) return result;

  const geocoded = await mapLimited(missing, 6, (z) => geocodeZip(z, token));
  const rows = missing
    .map((zip, i) => ({ zip, point: geocoded[i] }))
    .filter((r): r is { zip: string; point: ZipPoint } => r.point !== null);

  if (rows.length) {
    await prisma.zipGeo.createMany({
      data: rows.map((r) => ({ zip: r.zip, lat: r.point.lat, lng: r.point.lng, place: r.point.place })),
      skipDuplicates: true,
    });
    for (const r of rows) result.set(r.zip, r.point);
  }
  return result;
}
