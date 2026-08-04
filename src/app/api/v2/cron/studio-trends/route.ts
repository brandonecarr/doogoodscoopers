import { NextRequest, NextResponse } from "next/server";
import { isTrendEngineConfigured, refreshTrendTemplates } from "@/lib/studio/trends";

// Weekly: research what carousel formats are trending and append fresh, on-brand
// templates to the Content Studio library. CRON_SECRET-guarded like the others.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTrendEngineConfigured()) {
    return NextResponse.json({ success: false, error: "ANTHROPIC_API_KEY not set" }, { status: 200 });
  }
  try {
    const { added, generated } = await refreshTrendTemplates(3);
    return NextResponse.json({ success: true, added, generated });
  } catch (e) {
    console.error("[cron/studio-trends] failed:", e);
    return NextResponse.json({ success: false, error: "generation failed" }, { status: 200 });
  }
}
