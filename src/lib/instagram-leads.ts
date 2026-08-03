import prisma from "@/lib/prisma";
import { makeTrackingCode } from "@/lib/instagram";
import type { InstagramLead } from "@prisma/client";

// Click→signup correlation window: a quote that lands within this long after an
// Instagram lead clicked the tracked link is a candidate match (admin confirms).
const CORRELATION_BEFORE_MS = 5 * 60 * 1000; // small clock buffer
const CORRELATION_AFTER_MS = 24 * 60 * 60 * 1000; // up to a day later

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

export interface QuoteCandidate {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  zipCode: string | null;
  createdAt: string;
  minutesAfterClick: number;
}

/** Quote leads that landed shortly after THIS Instagram lead clicked — candidate conversions. */
export async function suggestQuotesForInstagramLead(lead: Pick<InstagramLead, "linkClickedAt" | "convertedQuoteLeadId">): Promise<QuoteCandidate[]> {
  if (!lead.linkClickedAt || lead.convertedQuoteLeadId) return [];
  const click = lead.linkClickedAt.getTime();
  const quotes = await prisma.quoteLead.findMany({
    where: {
      archived: false,
      instagramLeadId: null,
      createdAt: { gte: new Date(click - CORRELATION_BEFORE_MS), lte: new Date(click + CORRELATION_AFTER_MS) },
    },
    orderBy: { createdAt: "asc" },
    take: 8,
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, zipCode: true, createdAt: true },
  });
  return quotes.map((q) => ({
    id: q.id,
    name: [q.firstName, q.lastName].filter(Boolean).join(" ") || "Unknown",
    phone: q.phone,
    email: q.email,
    zipCode: q.zipCode,
    createdAt: q.createdAt.toISOString(),
    minutesAfterClick: Math.max(0, Math.round((q.createdAt.getTime() - click) / 60000)),
  }));
}

export interface InstaCandidate {
  id: string;
  username: string | null;
  campaignName: string | null;
  commentText: string | null;
  clickedAt: string;
  minutesBeforeQuote: number;
}

/** Instagram leads that clicked the tracked link shortly before THIS quote landed — candidate source. */
export async function suggestInstagramLeadsForQuote(quote: { id: string; createdAt: Date; instagramLeadId: string | null }): Promise<InstaCandidate[]> {
  if (quote.instagramLeadId) return [];
  const created = quote.createdAt.getTime();
  const leads = await prisma.instagramLead.findMany({
    where: {
      archived: false,
      convertedQuoteLeadId: null,
      linkClickedAt: { gte: new Date(created - CORRELATION_AFTER_MS), lte: new Date(created + CORRELATION_BEFORE_MS) },
    },
    orderBy: { linkClickedAt: "desc" },
    take: 8,
    select: { id: true, username: true, campaignName: true, commentText: true, linkClickedAt: true },
  });
  return leads.flatMap((l) =>
    l.linkClickedAt
      ? [{
          id: l.id,
          username: l.username,
          campaignName: l.campaignName,
          commentText: l.commentText,
          clickedAt: l.linkClickedAt.toISOString(),
          minutesBeforeQuote: Math.max(0, Math.round((created - l.linkClickedAt.getTime()) / 60000)),
        }]
      : [],
  );
}

/** Manually attribute an Instagram lead to a quote lead (admin-confirmed correlation match). */
export async function attributeInstagramLeadToQuote(instagramLeadId: string, quoteLeadId: string): Promise<boolean> {
  const [lead, quote] = await Promise.all([
    prisma.instagramLead.findUnique({ where: { id: instagramLeadId } }),
    prisma.quoteLead.findUnique({ where: { id: quoteLeadId } }),
  ]);
  if (!lead || !quote) return false;

  await prisma.quoteLead.update({
    where: { id: quoteLeadId },
    data: { sourceChannel: "instagram", instagramLeadId },
  });
  await prisma.instagramLead.update({
    where: { id: instagramLeadId },
    data: {
      status: "CONVERTED",
      convertedQuoteLeadId: quoteLeadId,
      convertedAt: lead.convertedAt ?? new Date(),
      firstName: lead.firstName ?? quote.firstName ?? null,
      lastName: lead.lastName ?? quote.lastName ?? null,
      email: lead.email ?? quote.email ?? null,
      phone: lead.phone ?? quote.phone ?? null,
      zipCode: lead.zipCode ?? quote.zipCode ?? null,
    },
  });
  return true;
}
