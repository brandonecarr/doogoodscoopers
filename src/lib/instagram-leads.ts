import prisma from "@/lib/prisma";
import { makeTrackingCode } from "@/lib/instagram";
import type { InstagramLead } from "@prisma/client";

/**
 * Turn a matching commenter into a lead — one row per person (deduped by IG user
 * id, else username). Repeat comments bump commentCount and refresh the latest
 * comment. Returns the lead (its stable trackingCode goes in the DM's quote link).
 */
export async function upsertInstagramLeadForComment(input: {
  igUserId?: string | null;
  username?: string | null;
  commentText?: string | null;
  commentId?: string | null;
  mediaId?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
}): Promise<InstagramLead> {
  const or: Array<{ igUserId?: string; username?: string }> = [];
  if (input.igUserId) or.push({ igUserId: input.igUserId });
  if (input.username) or.push({ username: input.username });
  const existing = or.length ? await prisma.instagramLead.findFirst({ where: { OR: or } }) : null;
  const now = new Date();

  if (existing) {
    return prisma.instagramLead.update({
      where: { id: existing.id },
      data: {
        commentCount: { increment: 1 },
        lastCommentAt: now,
        commentText: input.commentText ?? existing.commentText,
        commentId: input.commentId ?? existing.commentId,
        mediaId: input.mediaId ?? existing.mediaId,
        campaignId: input.campaignId ?? existing.campaignId,
        campaignName: input.campaignName ?? existing.campaignName,
        igUserId: existing.igUserId ?? input.igUserId ?? null,
        username: existing.username ?? input.username ?? null,
      },
    });
  }

  return prisma.instagramLead.create({
    data: {
      igUserId: input.igUserId ?? null,
      username: input.username ?? null,
      commentText: input.commentText ?? null,
      commentId: input.commentId ?? null,
      mediaId: input.mediaId ?? null,
      campaignId: input.campaignId ?? null,
      campaignName: input.campaignName ?? null,
      lastCommentAt: now,
      trackingCode: makeTrackingCode(),
    },
  });
}

/**
 * Close the loop: a lead came back from Sweep&Go carrying our tracking value
 * (`ig_<trackingCode>`, set on the /ig/<code> redirect). Link the resulting
 * QuoteLead to the InstagramLead and mark it converted. No-op if the value isn't
 * ours or the lead isn't found. Idempotent — safe to call on every delivery.
 */
export async function linkInstagramConversion(
  quoteLeadId: string,
  trackingFieldValue: string | null | undefined,
  contact: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null; zipCode?: string | null } = {},
): Promise<boolean> {
  const m = /^ig_(.+)$/.exec((trackingFieldValue || "").trim());
  if (!m) return false;
  const lead = await prisma.instagramLead.findUnique({ where: { trackingCode: m[1] } });
  if (!lead) return false;

  await prisma.quoteLead.update({
    where: { id: quoteLeadId },
    data: { sourceChannel: "instagram", instagramLeadId: lead.id },
  });
  await prisma.instagramLead.update({
    where: { id: lead.id },
    data: {
      status: "CONVERTED",
      convertedQuoteLeadId: quoteLeadId,
      convertedAt: lead.convertedAt ?? new Date(),
      firstName: lead.firstName ?? contact.firstName ?? null,
      lastName: lead.lastName ?? contact.lastName ?? null,
      email: lead.email ?? contact.email ?? null,
      phone: lead.phone ?? contact.phone ?? null,
      zipCode: lead.zipCode ?? contact.zipCode ?? null,
    },
  });
  return true;
}
