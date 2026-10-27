import { NextRequest, NextResponse } from "next/server";
import { refreshOpenSonaCalls } from "@/lib/sona-calls";

export const dynamic = "force-dynamic";

/** Every minute: finalize Sona calls the profile page isn't polling any more (tab closed, etc.). */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const refreshed = await refreshOpenSonaCalls();
    return NextResponse.json({ success: true, refreshed });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
