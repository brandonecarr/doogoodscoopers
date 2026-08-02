import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// PATCH → toggle active / edit a campaign. DELETE → remove it.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await request.json();

  const data: Record<string, unknown> = {};
  if (typeof b.active === "boolean") data.active = b.active;
  if (typeof b.name === "string") data.name = b.name.trim();
  if (typeof b.dmText === "string") data.dmText = b.dmText.trim();
  if (typeof b.publicReply === "string") data.publicReply = b.publicReply.trim() || null;
  if (typeof b.mediaId === "string") data.mediaId = b.mediaId.trim() || null;
  if (b.matchType === "whole" || b.matchType === "partial") data.matchType = b.matchType;
  if (Array.isArray(b.keywords)) data.keywords = b.keywords.map((k: string) => k.trim()).filter(Boolean);

  const campaign = await prisma.instagramCampaign.update({ where: { id }, data });
  return NextResponse.json({ success: true, campaign });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.instagramDm.deleteMany({ where: { campaignId: id } });
  await prisma.instagramCampaign.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
