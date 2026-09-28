import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateAndSaveWeeklyReport, isKeywordRadarConfigured } from "@/lib/keyword-radar";

// Run the keyword agent on demand ("Run now"). Regenerates this week's report.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isKeywordRadarConfigured()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." }, { status: 400 });
  }
  const res = await generateAndSaveWeeklyReport({ force: true });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 });
  return NextResponse.json({ ok: true, reportId: res.reportId, itemCount: res.itemCount });
}
