import { NextRequest, NextResponse } from "next/server";
import { runCanvasserDaily } from "@/lib/canvasser-daily";
import { getSession } from "@/lib/auth";

// Evening (Pacific): email each canvasser who worked today their recap.
// Auth: the Vercel cron Bearer token, OR a logged-in admin (to run on demand).
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authed =
    (cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) ||
    (await getSession());
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await runCanvasserDaily();
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("[cron/canvasser-daily]", e);
    return NextResponse.json({ success: false, error: "recap failed" }, { status: 500 });
  }
}
