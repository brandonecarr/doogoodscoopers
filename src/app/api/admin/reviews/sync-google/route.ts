import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { syncGoogleReviews } from "@/lib/reviews-sync";

// Pull all Google reviews for the connected location and upsert them into Review,
// auto-linking each to its customer. Triggered by the Sync button on /admin/reviews.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await syncGoogleReviews();
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    console.error("[sync-google]", message);
    const notConnected = /not connected/i.test(message);
    return NextResponse.json({ error: message }, { status: notConnected ? 400 : 502 });
  }
}
