import { NextRequest, NextResponse } from "next/server";
import { runAnomalyWatch } from "@/lib/anomaly-watch";
import { getSession } from "@/lib/auth";

// Daily: scan business vital signs and ping the owner about anything off.
// Auth: the Vercel cron Bearer token, OR a logged-in admin (so the owner can
// run the check on demand from the browser). Safe to run repeatedly.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authed =
    (cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) ||
    (await getSession());
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await runAnomalyWatch();
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("[cron/anomaly-watch]", e);
    return NextResponse.json({ success: false, error: "watch failed" }, { status: 500 });
  }
}
