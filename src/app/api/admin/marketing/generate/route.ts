import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateAndSaveWeeklyPlan, isMarketingDirectorConfigured } from "@/lib/marketing-director";

export const maxDuration = 300;

// Generate (or regenerate) this week's marketing plan on demand.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMarketingDirectorConfigured()) {
    return NextResponse.json({ error: "The marketing AI isn't configured yet (ANTHROPIC_API_KEY is not set)." }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const res = await generateAndSaveWeeklyPlan({ force: body?.regenerate === true });
  if (!res.ok) return NextResponse.json({ error: res.error || "Generation failed" }, { status: 502 });
  return NextResponse.json({ success: true, planId: res.planId });
}
