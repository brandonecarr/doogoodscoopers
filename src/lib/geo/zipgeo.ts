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

// Great-circle distance in km between two points.
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// An address hit farther than this from its own zip centroid is almost
// certainly a wrong-city match (e.g. a same-named street elsewhere), so we
// reject it and fall back to the zip centroid. Local zips span at most a few km;
// even the large desert zips here top out ~14km, so 25km is a safe ceiling.
const MAX_ADDRESS_KM = 25;

/**
 * Geocode a full street address (for the customer map pin). Biases the search
 * toward the customer's zip and rejects any result that lands implausibly far
 * from the zip centroid, falling back to the centroid itself. Returns null only
 * when nothing at all resolves or Mapbox isn't configured.
 */
export async function geocodeAddress(address: string | null | undefined, zip: string | null | undefined): Promise<ZipPoint | null> {
  const token = mapboxToken();
  if (!token) return null;
  const zip5 = normalizeZip(zip);

  // Resolve the zip centroid up front — it is both the search bias (proximity)
  // and the sanity check for the address hit, and the fallback if it fails.
  const zipPoint = zip5 ? (await resolveZips([zip5])).get(zip5) ?? null : null;

  if (address?.trim()) {
    const query = [address.trim(), zip5, "CA", "USA"].filter(Boolean).join(", ");
    let url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?country=US&types=address&limit=1&access_token=${encodeURIComponent(token)}`;
    if (zipPoint) url += `&proximity=${zipPoint.lng},${zipPoint.lat}`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as { features?: { center?: [number, number]; place_name?: string }[] };
        const f = data.features?.[0];
        if (f?.center && f.center.length >= 2) {
          const [lng, lat] = f.center;
          // Accept only if it's plausibly within the zip's area.
          if (!zipPoint || haversineKm(zipPoint.lat, zipPoint.lng, lat, lng) <= MAX_ADDRESS_KM) {
            return { lat, lng, place: f.place_name || "" };
          }
          // else: wrong-city match — fall through to the zip centroid below.
        }
      }
    } catch { /* fall through to zip centroid */ }
  }

  // Fallback: zip centroid (correct city, if not the exact street).
  return zipPoint;
}

export interface ReverseHit { address: string; city: string | null; zip: string | null; place: string }

/**
 * Reverse geocode a dropped pin (lat/lng → nearest street address). Used by the
 * canvasser tool so a rep sees the house address for a pin they just dropped.
 * Returns null if Mapbox isn't configured or nothing resolves.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseHit | null> {
  const token = mapboxToken();
  if (!token || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
    `?country=US&types=address&limit=1&access_token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: {
        place_name?: string;
        text?: string;
        address?: string;
        context?: { id: string; text: string }[];
      }[];
    };
    const f = data.features?.[0];
    if (!f) return null;
    // House number + street from `address` (number) + `text` (street name).
    const street = [f.address, f.text].filter(Boolean).join(" ").trim();
    const ctx = f.context || [];
    const city = ctx.find((c) => c.id.startsWith("place"))?.text || null;
    const zip = ctx.find((c) => c.id.startsWith("postcode"))?.text || null;
    return { address: street || f.place_name?.split(",")[0] || "", city, zip, place: f.place_name || "" };
  } catch {
    return null;
  }
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
