import { NextRequest, NextResponse } from "next/server";
import { verifyResumeToken, resumePrefill, recordResumeOpened } from "@/lib/quote-resume";

// GET ?token= → the lead's earlier answers, so the quote wizard can pick up where they left off.
// Public, but only reachable with a signed token from a message we sent them.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const parsed = verifyResumeToken(request.nextUrl.searchParams.get("token") || "");
  if (!parsed) return NextResponse.json({ error: "This link is no longer valid." }, { status: 400 });
  const prefill = await resumePrefill(parsed.leadType, parsed.leadId);
  if (!prefill) return NextResponse.json({ error: "This link is no longer valid." }, { status: 404 });
  await recordResumeOpened(parsed.leadType, parsed.leadId);
  return NextResponse.json({ prefill }, { headers: { "Cache-Control": "no-store" } });
}
