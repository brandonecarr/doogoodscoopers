import { NextRequest, NextResponse } from "next/server";
import { resolveResume, recordResumeOpen, recoverySettings, FREQUENCY_LABEL, type ResumeChannel } from "@/lib/quote-recovery";

// Card labels on the resume page (the design calls for short forms).
const SHORT_FREQUENCY: Record<string, string> = {
  once_a_week: "Weekly", weekly: "Weekly", two_times_a_week: "2x weekly", bi_weekly: "Bi-weekly", biweekly: "Bi-weekly",
  once_a_month: "Monthly", monthly: "Monthly", one_time: "One-time", onetime: "One-time",
};

// The website's resume page (doogoodscoopers.com/r/?c=CODE) calls this to show
// "Welcome back" and to get the prefilled schedule-page link. Public, but a code is
// unguessable (31^6) and only ever handed to its own lead.
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["https://doogoodscoopers.com", "https://www.doogoodscoopers.com", "http://localhost:3000"]);
function cors(req: NextRequest, res: NextResponse) {
  const origin = req.headers.get("origin") || "";
  if (ALLOWED.has(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
  }
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function OPTIONS(req: NextRequest) {
  return cors(req, new NextResponse(null, { status: 204 }));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[A-Za-z0-9]{6}$/.test(code)) return cors(req, NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 }));
  const r = await resolveResume(code);
  if (!r.ok) return cors(req, NextResponse.json({ ok: false, reason: r.reason, quoteUrl: r.quoteUrl }, { status: r.reason === "not_found" ? 404 : 410 }));

  const ch = req.nextUrl.searchParams.get("ch");
  const channel: ResumeChannel = ch === "s" ? "sms" : ch === "e" ? "email" : "other";
  await recordResumeOpen(r.lead.id, channel).catch((e) => console.error("[resume] open note failed", e));

  const s = await recoverySettings();
  const l = r.lead;
  const dogs = l.numberOfDogs ? `${l.numberOfDogs} ${l.numberOfDogs === "1" ? "dog" : "dogs"}` : null;
  // Quoted price as the wizard stored it, e.g. "$81/monthly + Initial Cleaning Prices Vary
  // + Sanitization Spray $25 per visit" or "$99* For Your One-Time Cleanup".
  const qp = r.quotedPrice || "";
  const monthly = qp.match(/^\$(\d+(?:\.\d+)?)\/month/);
  const oneTime = /one-time/i.test(qp) ? qp.match(/^\$(\d+)/)?.[1] ?? null : null;
  const initial = qp.match(/initial[^+]*?\$(\d+(?:\.\d+)?)/i);
  const addOn = qp.split(" + ").find((part) => /spray|sanit|deodor/i.test(part)) || null;
  return cors(req, NextResponse.json({
    ok: true,
    firstName: (l.firstName || "").trim().split(/\s+/)[0] || "",
    summary: [dogs, l.frequency ? FREQUENCY_LABEL[l.frequency] || l.frequency.replace(/_/g, " ") : null, l.zipCode ? `in ${l.zipCode}` : null].filter(Boolean).join(" · "),
    price: r.quotedPrice,
    resumeCode: l.resumeCode,
    dogs,
    frequency: l.frequency ? SHORT_FREQUENCY[l.frequency] || l.frequency.replace(/_/g, " ") : null,
    zip: l.zipCode || null,
    monthlyPrice: monthly ? `$${monthly[1]}` : null,
    oneTimePrice: oneTime ? `$${oneTime}` : null,
    initialCleaning: initial ? `$${initial[1]}` : null, // null → "Priced after first visit"
    addOn: addOn ? addOn.trim() : null,
    continueUrl: r.continueUrl,
    coupon: s.coupon,
    expiresAt: r.expiresAt?.toISOString() ?? null,
  }));
}
