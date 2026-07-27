import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listCallsWith, normalizePhoneNumber, isQuoConfigured } from "@/lib/quo";
import { analyzeCall, isCallIntelConfigured, formatTranscript } from "@/lib/call-intel";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST { phone } → DRY RUN. Pulls the most substantial recent call with that
// number, runs the AI extraction, and returns what it found. Writes nothing —
// this is the "show me before you trust it" preview.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isQuoConfigured()) return NextResponse.json({ error: "Quo isn't configured." }, { status: 400 });
  if (!isCallIntelConfigured()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY isn't set, so AI call notes can't run." }, { status: 400 });
  }

  const { phone } = await request.json().catch(() => ({ phone: "" }));
  const normalized = normalizePhoneNumber(String(phone || ""));
  if (!normalized) return NextResponse.json({ error: "Enter a valid 10-digit phone number." }, { status: 400 });

  const calls = await listCallsWith(normalized, 10);
  if (calls.length === 0) {
    return NextResponse.json({ error: "No calls found with that number in Quo." }, { status: 404 });
  }
  // Longest call has the most to extract from.
  const target = [...calls].sort((a, b) => (b.duration || 0) - (a.duration || 0))[0];

  const analyzed = await analyzeCall(target.id);
  if (!analyzed) {
    return NextResponse.json({ error: "That call has no transcript in Quo yet." }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    call: { id: target.id, duration: target.duration, direction: target.direction, createdAt: target.createdAt },
    transcript: formatTranscript(analyzed.transcript),
    intel: analyzed.intel,
    note: "Dry run — nothing was saved.",
  });
}
