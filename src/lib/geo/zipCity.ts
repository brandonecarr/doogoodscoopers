import { lookup } from "zipcodes";

/** First 5-digit run from a raw zip (handles ZIP+4 and stray characters). */
export function normalizeZip5(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = String(raw).match(/\d{5}/);
  return m ? m[0] : null;
}

/**
 * US ZIP → city name, resolved offline from the `zipcodes` dataset.
 *
 * Leads always carry a zip but often no city, so lead detail cards derive the
 * city from the zip for display. Returns null for a missing or unknown zip.
 * Server-only (the dataset is large); import from server components/actions.
 */
export function cityFromZip(rawZip: string | null | undefined): string | null {
  const zip = normalizeZip5(rawZip);
  if (!zip) return null;
  return lookup(zip)?.city ?? null;
}

/** ZIP → "City, ST" (or just the city, or null) for one-line display. */
export function cityStateFromZip(rawZip: string | null | undefined): string | null {
  const zip = normalizeZip5(rawZip);
  if (!zip) return null;
  const rec = lookup(zip);
  if (!rec?.city) return null;
  return rec.state ? `${rec.city}, ${rec.state}` : rec.city;
}
