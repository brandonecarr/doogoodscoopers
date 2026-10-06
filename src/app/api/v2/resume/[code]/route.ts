import { NextRequest, NextResponse } from "next/server";
import { resolveResume, recordResumeOpen, recoverySettings, FREQUENCY_LABEL, type ResumeChannel } from "@/lib/quote-recovery";

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
  return cors(req, NextResponse.json({
    ok: true,
    firstName: (l.firstName || "").trim().split(/\s+/)[0] || "",
    summary: [dogs, l.frequency ? FREQUENCY_LABEL[l.frequency] || l.frequency.replace(/_/g, " ") : null, l.zipCode ? `in ${l.zipCode}` : null].filter(Boolean).join(" · "),
    price: r.quotedPrice,
    continueUrl: r.continueUrl,
    coupon: s.coupon,
    expiresAt: r.expiresAt?.toISOString() ?? null,
  }));
}
