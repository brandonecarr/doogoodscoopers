import { NextRequest, NextResponse } from "next/server";
import { generateAndSaveWeeklyReport, isKeywordRadarConfigured } from "@/lib/keyword-radar";

// Weekly: the Keyword Radar agent researches this week's new/trending/hot keywords
// (and enriches with Google Ads data when connected). Idempotent per week.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isKeywordRadarConfigured()) {
    return NextResponse.json({ success: false, skipped: "anthropic_not_configured" });
  }
  const res = await generateAndSaveWeeklyReport();
  if (!res.ok) {
    console.error("[cron/keyword-weekly]", res.error);
    return NextResponse.json({ success: false, error: res.error }, { status: 502 });
  }
  return NextResponse.json({ success: true, reportId: res.reportId, itemCount: res.itemCount, skipped: res.skipped ?? false });
}
