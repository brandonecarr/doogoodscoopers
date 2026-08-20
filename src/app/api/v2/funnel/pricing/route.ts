import { NextResponse } from "next/server";
import { sngPrice } from "@/lib/sweepandgo-zip";

// Funnel pricing. Sweep&Go's real onboarding price is the source of truth; falls
// back to the local get-pricing if SNG can't be reached / has no price. Both are
// normalized to { amount, interval, initialFee } for the renderer.
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const normInterval = (raw?: string): string => {
  const s = (raw || "").toLowerCase();
  if (s.includes("month")) return "month";
  if (s.includes("week")) return "week";
  if (s.includes("visit") || s.includes("cleanup") || s.includes("clean_up")) return "visit";
  return raw || "month";
};

// Visits per month by funnel frequency, on Sweep&Go's 4.33-weeks/month basis, so
// per-visit matches theirs exactly ($168/mo ÷ 8.66 = $19.40/visit).
const WEEKS_PER_MONTH = 4.33;
const VPM: Record<string, number> = {
  once_a_week: WEEKS_PER_MONTH,
  two_times_a_week: WEEKS_PER_MONTH * 2,
  bi_weekly: WEEKS_PER_MONTH / 2,
  once_a_month: 1,
  one_time: 1,
};
const round2 = (n: number) => Math.round(n * 100) / 100;

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

  const vpm = VPM[frequency] ?? 4.33;
  const oneTime = frequency === "one_time";

  const sng = await sngPrice({ zip, frequency, dogs, lastCleaned, cfOverride, includeRaw: debug, isOneTime: oneTime });
  if (sng && !sng.priceNotConfigured && sng.amount != null) {
    const isMonthly = normInterval(sng.interval) === "month";
    const monthly = isMonthly ? sng.amount : round2(sng.amount * vpm);
    const perVisit = oneTime ? sng.amount : isMonthly ? round2(sng.amount / vpm) : sng.amount;
    return NextResponse.json({
      success: true, source: "sweepandgo",
      pricing: {
        perVisit, monthly: oneTime ? null : monthly, initialFee: sng.initialFee ?? null,
        oneTime, zipType: sng.zipType ?? null, priceNotConfigured: false,
      },
      ...(debug ? { raw: sng.raw } : {}),
    });
  }

  // Fallback → the existing Supabase-backed pricing.
  try {
    const qs = new URLSearchParams({ zipCode: zip, numberOfDogs: dogs, frequency, ...(lastCleaned ? { lastCleaned } : {}) });
    const res = await fetch(`${url.origin}/api/v2/get-pricing?${qs.toString()}`);
    const d = await res.json().catch(() => null);
    if (res.ok && d?.pricing) {
      const pr = d.pricing;
      return NextResponse.json({
        success: true, source: "fallback",
        pricing: {
          perVisit: pr.recurringPrice ?? pr.basePrice ?? null,
          monthly: oneTime ? null : (pr.monthlyPrice ?? null),
          initialFee: pr.initialCleanupFee || null, oneTime, zipType: null,
          priceNotConfigured: !!pr.priceNotConfigured,
        },
        ...(debug ? { sngRaw: sng?.raw ?? null } : {}),
      });
    }
  } catch { /* fall through */ }

  return NextResponse.json({ success: false, source: "none", pricing: { priceNotConfigured: true }, ...(debug ? { sngRaw: sng?.raw ?? null } : {}) });
}
