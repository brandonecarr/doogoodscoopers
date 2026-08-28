import prisma from "@/lib/prisma";

/**
 * Local rank grid — the Local Falcon / BrightLocal idea.
 *
 * Google's local results are distance-sensitive: a business can sit at #1 from
 * its own doorstep and be invisible two miles away. Asking "where do we rank?"
 * once is therefore meaningless. This samples the same keyword from a grid of
 * lat/lng points across a city and records the rank at each one, which is what
 * turns ranking into a map you can act on.
 *
 * TWO DATA SOURCES, and the choice matters enormously:
 *
 *  - Scrappa (preferred): reads the live Google Maps result set, which
 *    INCLUDES service-area businesses. DooGoodScoopers is an SAB with a hidden
 *    address, so this is the only source that can see us at all.
 *  - Google Places API (fallback): cheaper and already configured, but Google's
 *    Places index OMITS service-area businesses with hidden addresses (a
 *    long-standing documented limitation). Verified live: a name search for
 *    "DooGoodScoopers" returns 0 results with no location bias, while
 *    competitors with public addresses return fine. Useful for competitor
 *    tracking; useless for tracking ourselves.
 *
 * Whichever source is used, it approximates the live 3-pack rather than
 * reproducing it exactly — the caveat every tool in this category carries.
 */

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const MAX_RESULTS = 20;      // Text Search caps here
const CONCURRENCY = 5;
const POINT_TIMEOUT_MS = 12_000;
/** Cost guard: refuse absurd grids. 13x13 = 169 points. */
export const MAX_GRID = 13;
/** Google Places Text Search (Pro SKU), USD per call, after 5,000 free/month. */
export const COST_PER_CALL_USD = 0.032;
export type Provider = "scrappa" | "places";

const SCRAPPA_URL = "https://scrappa.co/api/maps/advanced-search";
/** Scrappa bills 1 credit per request; the free tier is 500 credits a month. */
export const SCRAPPA_CREDITS_PER_CALL = 1;
export const SCRAPPA_FREE_MONTHLY = 500;

function scrappaKey(): string | undefined {
  return process.env.SCRAPPA_API_KEY || undefined;
}

/**
 * Scrappa reads real Google Maps results, so it can see service-area businesses.
 * Places cannot, and is only a fallback for competitor tracking.
 */
export function activeProvider(): Provider {
  return scrappaKey() ? "scrappa" : "places";
}

export const costPerCall = (p: Provider) => (p === "scrappa" ? 0 : COST_PER_CALL_USD);

export interface GridPoint { lat: number; lng: number }

/** N x N points centred on (lat,lng), `spacingKm` apart. */
export function buildGrid(lat: number, lng: number, size: number, spacingKm: number): GridPoint[] {
  const n = Math.max(3, Math.min(size, MAX_GRID));
  const half = (n - 1) / 2;
  const dLat = spacingKm / 111.32;
  const dLng = spacingKm / (111.32 * Math.cos((lat * Math.PI) / 180) || 1);
  const pts: GridPoint[] = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      pts.push({
        lat: lat + (row - half) * dLat,
        lng: lng + (col - half) * dLng,
      });
    }
  }
  return pts;
}

export const estimateCostUsd = (points: number, provider: Provider = activeProvider()) =>
  points * costPerCall(provider);

function apiKey(): string | undefined {
  return process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || undefined;
}

/** Loose name match — "DooGoodScoopers" vs "Doo Good Scoopers LLC". */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function matches(candidate: string, business: string): boolean {
  const a = norm(candidate), b = norm(business);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

interface PointResult { lat: number; lng: number; rank: number | null; topNames: string }

/** One Google Maps-ish result set from Google Places, biased to this point. */
async function rankAtPoint(p: GridPoint, keyword: string, business: string, key: string): Promise<PointResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POINT_TIMEOUT_MS);
  try {
    const res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        // Minimal field mask — extra fields reprice the call to a dearer SKU,
        // and rank only needs the name.
        "X-Goog-FieldMask": "places.displayName",
      },
      body: JSON.stringify({
        textQuery: keyword,
        locationBias: { circle: { center: { latitude: p.lat, longitude: p.lng }, radius: 1500 } },
        maxResultCount: MAX_RESULTS,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 180)}` : ""}`);
    }
    const json = (await res.json()) as { places?: { displayName?: { text?: string } }[] };
    const names = (json.places || []).map((x) => x.displayName?.text || "").filter(Boolean);
    const idx = names.findIndex((n) => matches(n, business));
    return {
      lat: p.lat,
      lng: p.lng,
      rank: idx >= 0 ? idx + 1 : null,
      topNames: names.slice(0, 3).join(", "),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** One Google Maps result set as seen from this coordinate, via Scrappa. */
async function rankAtPointScrappa(p: GridPoint, keyword: string, business: string, key: string): Promise<PointResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const url =
      `${SCRAPPA_URL}?query=${encodeURIComponent(keyword)}` +
      `&lat=${p.lat.toFixed(6)}&lon=${p.lng.toFixed(6)}&zoom=14&limit=20&hl=en&gl=us`;
    const res = await fetch(url, { headers: { "x-api-key": key }, signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${body ? `: ${body.replace(/\s+/g, " ").slice(0, 240)}` : ""}`);
    }
    const json = await res.json();

    // Their docs disagree on the wrapper (`items` in one place, `results` in
    // another). Accepting both costs nothing; guessing wrong would silently
    // report "not ranking" at every single point.
    const rows = (json?.items ?? json?.results ?? json?.data ?? []) as { name?: string; title?: string }[];
    if (!Array.isArray(rows)) throw new Error("unexpected response shape");

    const names = rows.map((r) => r.name || r.title || "").filter(Boolean);
    const idx = names.findIndex((n) => matches(n, business));
    return {
      lat: p.lat,
      lng: p.lng,
      rank: idx >= 0 ? idx + 1 : null,
      topNames: names.slice(0, 3).join(", "),
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface ScanResult {
  ok: boolean;
  scanId?: string;
  error?: string;
}

export async function runRankScan(opts: {
  cityId: string;
  keyword: string;
  businessName: string;
}): Promise<ScanResult> {
  const provider = activeProvider();
  const key = apiKey();
  const sKey = scrappaKey();
  if (provider === "scrappa" && !sKey) return { ok: false, error: "Scrappa API key missing." };
  if (provider === "places" && !key) return { ok: false, error: "No Google Maps API key configured." };

  const city = await prisma.rankGridCity.findUnique({ where: { id: opts.cityId } });
  if (!city) return { ok: false, error: "City not found." };

  const points = buildGrid(city.lat, city.lng, city.gridSize, city.spacingKm);

  const results: PointResult[] = [];
  let firstError = "";
  for (let i = 0; i < points.length; i += CONCURRENCY) {
    const batch = points.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((p) =>
        provider === "scrappa"
          ? rankAtPointScrappa(p, opts.keyword, opts.businessName, sKey as string)
          : rankAtPoint(p, opts.keyword, opts.businessName, key as string)
      )
    );
    for (let j = 0; j < settled.length; j++) {
      const s = settled[j];
      if (s.status === "fulfilled") results.push(s.value);
      else {
        if (!firstError) firstError = s.reason instanceof Error ? s.reason.message : "point failed";
        // A failed point is UNKNOWN, not "not ranking" — recording it as a miss
        // would quietly turn an API problem into a fake red square.
        results.push({ lat: batch[j].lat, lng: batch[j].lng, rank: null, topNames: "" });
      }
    }
  }

  // If every single point failed, the scan is meaningless — surface it instead
  // of storing a grid of red.
  const allFailed = firstError && results.every((r) => r.rank === null && !r.topNames);
  if (allFailed) return { ok: false, error: firstError };

  const found = results.filter((r) => r.rank !== null);
  const top3 = found.filter((r) => (r.rank as number) <= 3);
  const avgRank = found.length ? found.reduce((n, r) => n + (r.rank as number), 0) / found.length : null;

  const scan = await prisma.rankGridScan.create({
    data: {
      cityId: city.id,
      cityName: city.name,
      keyword: opts.keyword,
      businessName: opts.businessName,
      gridSize: city.gridSize,
      spacingKm: city.spacingKm,
      pointCount: results.length,
      foundCount: found.length,
      top3Count: top3.length,
      avgRank,
      status: firstError ? "partial" : "ok",
      error: firstError || null,
    },
  });

  await prisma.rankGridPoint.createMany({
    data: results.map((r) => ({
      scanId: scan.id, lat: r.lat, lng: r.lng, rank: r.rank, topNames: r.topNames || null,
    })),
  });

  return { ok: true, scanId: scan.id };
}

/**
 * ONE lookup, to answer the question that actually matters before spending a
 * grid: can this data source see us at all? Places could not (service-area
 * businesses are absent from its index), and finding that out cost a whole
 * feature. A fraction of a cent is a better way to learn it.
 */
export async function testProvider(opts: {
  keyword: string;
  businessName: string;
  lat: number;
  lng: number;
}): Promise<{
  provider: Provider;
  ok: boolean;
  found: boolean;
  rank: number | null;
  topNames: string;
  costUsd: number;
  error?: string;
}> {
  const provider = activeProvider();
  const key = apiKey();
  const base = { provider, found: false, rank: null as number | null, topNames: "", costUsd: costPerCall(provider) };

  try {
    if (provider === "scrappa") {
      const sKey = scrappaKey();
      if (!sKey) return { ...base, ok: false, error: "Scrappa API key missing." };
      const r = await rankAtPointScrappa({ lat: opts.lat, lng: opts.lng }, opts.keyword, opts.businessName, sKey);
      return { ...base, ok: true, found: r.rank !== null, rank: r.rank, topNames: r.topNames };
    }
    if (!key) return { ...base, ok: false, error: "No Google Maps API key configured." };
    const r = await rankAtPoint({ lat: opts.lat, lng: opts.lng }, opts.keyword, opts.businessName, key);
    return { ...base, ok: true, found: r.rank !== null, rank: r.rank, topNames: r.topNames };
  } catch (e) {
    return { ...base, ok: false, error: e instanceof Error ? e.message : "lookup failed" };
  }
}
