import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getSetting, setSetting, getAccessToken, fetchAllReviews, starToNumber } from "@/lib/google-business";

// Pull all Google reviews for the connected location and upsert them into Review.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accountId = await getSetting("google.bp.accountId");
  const locationId = await getSetting("google.bp.locationId");
  if (!accountId || !locationId) {
    return NextResponse.json({ error: "Not connected, or no Google location found. Reconnect from the Reviews page." }, { status: 400 });
  }

  try {
    const token = await getAccessToken();
    const { reviews, averageRating, totalReviewCount } = await fetchAllReviews(token, accountId, locationId);

    let imported = 0;
    for (const r of reviews) {
      if (!r.reviewId) continue;
      const externalId = `google:${r.reviewId}`;
      const data = {
        customerName: r.reviewer?.displayName || "Google user",
        platform: "google",
        status: "COMPLETED",
        rating: starToNumber(r.starRating),
        reviewText: r.comment || null,
        reviewedAt: r.createTime ? new Date(r.createTime) : null,
        reply: r.reviewReply?.comment || null,
      };
      await prisma.review.upsert({ where: { externalId }, create: { externalId, ...data }, update: data });
      imported++;
    }

    await setSetting("google.bp.lastSyncedAt", new Date().toISOString());
    if (averageRating != null) await setSetting("google.bp.avgRating", String(averageRating));
    if (totalReviewCount != null) await setSetting("google.bp.reviewCount", String(totalReviewCount));

    return NextResponse.json({ success: true, imported, averageRating, totalReviewCount });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    console.error("[sync-google]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
