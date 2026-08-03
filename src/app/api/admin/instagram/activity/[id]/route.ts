import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { fetchMediaInfo, fetchCommentInfo, matchesKeywords } from "@/lib/instagram";

// Detail for one activity row (an InstagramDm): stored fields + this commenter's
// history with us + live post/comment info from Instagram.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const dm = await prisma.instagramDm.findUnique({ where: { id } });
  if (!dm) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const campaign = await prisma.instagramCampaign.findUnique({ where: { id: dm.campaignId } });
  const matchedKeyword =
    campaign?.keywords.find((k) => matchesKeywords(dm.commentText ?? "", [k], campaign.matchType)) ?? null;

  // Everything this same commenter (by handle or IG user id) has done on our posts.
  const orConds: Array<{ username?: string; igUserId?: string }> = [];
  if (dm.username) orConds.push({ username: dm.username });
  if (dm.igUserId) orConds.push({ igUserId: dm.igUserId });
  const [history, historyCount] = orConds.length
    ? await Promise.all([
        prisma.instagramDm.findMany({
          where: { id: { not: dm.id }, OR: orConds },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, commentText: true, status: true, createdAt: true },
        }),
        prisma.instagramDm.count({ where: { id: { not: dm.id }, OR: orConds } }),
      ])
    : [[], 0];

  // Live enrichment (best-effort; null if the comment/post was deleted or the API errors).
  const [media, comment] = await Promise.all([fetchMediaInfo(dm.mediaId), fetchCommentInfo(dm.commentId)]);

  return NextResponse.json({
    dm: {
      id: dm.id,
      username: dm.username,
      igUserId: dm.igUserId,
      commentText: dm.commentText ?? "",
      dmText: dm.text,
      status: dm.status,
      error: dm.error,
      createdAt: dm.createdAt,
      sentAt: dm.sentAt,
      mediaId: dm.mediaId,
      commentId: dm.commentId,
    },
    campaign: campaign
      ? { id: campaign.id, name: campaign.name, matchType: campaign.matchType, publicReply: campaign.publicReply }
      : null,
    matchedKeyword,
    history,
    historyCount,
    media,
    comment,
  });
}
