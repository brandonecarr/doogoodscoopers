import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { googleAdsDiagnostic } from "@/lib/google-ads";

// Visit while logged in to see exactly what the Google Ads Keyword Planner call
// returns (status + error body) — for diagnosing why enrichment is empty.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await googleAdsDiagnostic();
  return NextResponse.json(result);
}
