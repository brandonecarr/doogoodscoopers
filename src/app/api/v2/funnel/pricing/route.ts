import { NextResponse } from "next/server";
import { sngPrice } from "@/lib/sweepandgo-zip";

// Funnel pricing. Sweep&Go's real onboarding price is the source of truth; falls
// back to the local get-pricing if SNG can't be reached / has no price.
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const zip = (url.searchParams.get("zipCode") || "").trim();
  const dogs = (url.searchParams.get("numberOfDogs") || "").trim();
  const frequency = (url.searchParams.get("frequency") || "").trim();
  const lastCleaned = url.searchParams.get("lastCleaned") || undefined;
  const debug = url.searchParams.get("debug") === "1";
  const cfOverride = url.searchParams.get("cf") || undefined;

  if (!/^\d{5}$/.test(zip) || !frequency) {
    return NextResponse.json({ error: "zipCode and frequency are required" }, { status: 400 });
  }

  const sng = await sngPrice({ zip, frequency, dogs, lastCleaned, cfOverride, includeRaw: debug });
  if (sng && !sng.priceNotConfigured) {
    return NextResponse.json({ success: true, source: "sweepandgo", pricing: sng, ...(debug ? { raw: sng.raw } : {}) });
  }

  // Fallback → the existing Supabase-backed pricing.
  try {
    const qs = new URLSearchParams({ zipCode: zip, numberOfDogs: dogs, frequency, ...(lastCleaned ? { lastCleaned } : {}) });
    const res = await fetch(`${url.origin}/api/v2/get-pricing?${qs.toString()}`);
    const d = await res.json().catch(() => null);
    if (res.ok && d?.pricing) {
      return NextResponse.json({ success: true, source: "fallback", pricing: d.pricing, ...(debug ? { sngRaw: sng?.raw ?? null } : {}) });
    }
  } catch { /* fall through */ }

  return NextResponse.json({ success: false, source: "none", pricing: { priceNotConfigured: true }, ...(debug ? { sngRaw: sng?.raw ?? null } : {}) });
}
