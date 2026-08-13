import { NextRequest, NextResponse } from "next/server";
import { generateAndSaveWeeklyPlan, isMarketingDirectorConfigured } from "@/lib/marketing-director";

// Weekly: the AI Marketing Director generates that week's action plan. Idempotent
// per week (won't regenerate if a plan already exists), no-ops without an API key.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isMarketingDirectorConfigured()) {
    return NextResponse.json({ success: false, skipped: "anthropic_not_configured" });
  }
  const res = await generateAndSaveWeeklyPlan();
  if (!res.ok) {
    console.error("[cron/marketing-weekly]", res.error);
    return NextResponse.json({ success: false, error: res.error }, { status: 502 });
  }
  return NextResponse.json({ success: true, planId: res.planId, skipped: res.skipped ?? false });
}
