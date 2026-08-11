import prisma from "@/lib/prisma";
import { getSetting, setSetting, getAccessToken, fetchAllReviews, starToNumber } from "@/lib/google-business";

export interface ReviewSyncResult {
  imported: number;
  linked: number;
  averageRating?: number;
  totalReviewCount?: number;
}

/**
 * Pull every Google review for the connected location, upsert them into `Review`,
 * and auto-link each to its `SweepandgoCustomer` by reviewer name when the match is
 * unambiguous. Shared by the manual admin route and the daily cron.
 *
 * Throws "Not connected…" if Google isn't linked yet, or a Google API error on failure.
 */
export async function syncGoogleReviews(): Promise<ReviewSyncResult> {
  const accountId = await getSetting("google.bp.accountId");
  const locationId = await getSetting("google.bp.locationId");
  if (!accountId || !locationId) {
    throw new Error("Not connected, or no Google location found. Reconnect from the Reviews page.");
  }

  const token = await getAccessToken();
  const { reviews, averageRating, totalReviewCount } = await fetchAllReviews(token, accountId, locationId);

  // Build a full-name → customerId index for auto-linking. A name that maps to more
  // than one customer is marked ambiguous (null) and left unlinked, so a review is
  // never attached to the wrong person. (Google reviews only expose a display name.)
  const customers = await prisma.sweepandgoCustomer.findMany({
    select: { id: true, firstName: true, lastName: true },
  });
  const byName = new Map<string, string | null>();
  for (const c of customers) {
    const nm = [c.firstName, c.lastName].filter(Boolean).join(" ").trim().toLowerCase();
    if (nm) byName.set(nm, byName.has(nm) ? null : c.id);
  }

  let imported = 0;
  let linked = 0;
  for (const r of reviews) {
    if (!r.reviewId) continue;
    const externalId = `google:${r.reviewId}`;

    const nameKey = (r.reviewer?.displayName || "").trim().toLowerCase();
    const linkId = (nameKey ? byName.get(nameKey) : undefined) ?? null;
    if (linkId) linked++;

    const base = {
      customerName: r.reviewer?.displayName || "Google user",
      platform: "google",
      status: "COMPLETED",
      rating: starToNumber(r.starRating),
      reviewText: r.comment || null,
      reviewedAt: r.createTime ? new Date(r.createTime) : null,
      reply: r.reviewReply?.comment || null,
    };

    await prisma.review.upsert({
      where: { externalId },
      // On create, store the link (may be null). On update, only set the link when we
      // found one — never clear an existing (possibly hand-set) link on re-sync.
      create: { externalId, ...base, sngCustomerId: linkId },
      update: { ...base, ...(linkId ? { sngCustomerId: linkId } : {}) },
    });
    imported++;
  }

  await setSetting("google.bp.lastSyncedAt", new Date().toISOString());
  if (averageRating != null) await setSetting("google.bp.avgRating", String(averageRating));
  if (totalReviewCount != null) await setSetting("google.bp.reviewCount", String(totalReviewCount));

  return { imported, linked, averageRating, totalReviewCount };
}
