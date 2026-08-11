import { NextRequest, NextResponse } from "next/server";
import { googleOAuthConfigured } from "@/lib/google-business";
import { syncGoogleReviews } from "@/lib/reviews-sync";

// Daily: pull Google Business reviews for the connected location and auto-link them
// to customers. No-ops (not an error) until the owner connects Google on /admin/reviews.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!googleOAuthConfigured()) {
    return NextResponse.json({ success: false, skipped: "google_oauth_not_configured" });
  }

  try {
    const result = await syncGoogleReviews();
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    // "Not connected" is expected until Google is linked — skip quietly, don't fail the cron.
    if (/not connected/i.test(message)) {
      return NextResponse.json({ success: false, skipped: "not_connected" });
    }
    console.error("[cron/sync-reviews]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
