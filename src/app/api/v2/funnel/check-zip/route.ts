import { NextResponse } from "next/server";
import { sngCheckZip } from "@/lib/sweepandgo-zip";

// The funnel's ZIP check. Sweep&Go is the source of truth — we ask their official
// API first. If SNG can't be reached, we fall back to the local /admin service-
// area list so the funnel never breaks on an SNG blip.
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function POST(request: Request) {
  const { zipCode } = await request.json().catch(() => ({}));
  const zip = String(zipCode || "").trim();
  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: "Please enter a valid 5-digit ZIP code.", inServiceArea: false }, { status: 400 });
  }

  // 1) Sweep&Go (authoritative). `debug=1` echoes the raw payload for verification.
  const debug = new URL(request.url).searchParams.get("debug") === "1";
  const sng = await sngCheckZip(zip, debug);
  if (sng) {
    return NextResponse.json({
      inServiceArea: sng.inServiceArea,
      registrationUrl: sng.registrationUrl,
      source: "sweepandgo",
      ...(debug ? { raw: sng.raw } : {}),
    });
  }

  // 2) Fallback → the existing Supabase-backed check.
  try {
    const origin = new URL(request.url).origin;
    const res = await fetch(`${origin}/api/v2/check-zip`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ zipCode: zip }),
    });
    const d = await res.json().catch(() => null);
    if (res.ok && d && typeof d.inServiceArea === "boolean") {
      return NextResponse.json({ inServiceArea: d.inServiceArea, pricingZone: d.pricingZone ?? null, source: "fallback" });
    }
  } catch { /* fall through */ }

  return NextResponse.json({ error: "We couldn't check that ZIP just now.", inServiceArea: false }, { status: 502 });
}
