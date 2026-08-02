import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// POST → create an Instagram comment→DM campaign.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await request.json();
  const name = (b.name || "").trim();
  const dmText = (b.dmText || "").trim();
  const keywords: string[] = (Array.isArray(b.keywords) ? b.keywords : String(b.keywords || "").split(","))
    .map((k: string) => k.trim())
    .filter(Boolean);

  if (!name) return NextResponse.json({ error: "Give the campaign a name." }, { status: 400 });
  if (keywords.length === 0) return NextResponse.json({ error: "Add at least one trigger keyword." }, { status: 400 });
  if (!dmText) return NextResponse.json({ error: "Write the DM to send." }, { status: 400 });

  const campaign = await prisma.instagramCampaign.create({
    data: {
      name,
      mediaId: (b.mediaId || "").trim() || null,
      keywords,
      matchType: b.matchType === "whole" ? "whole" : "partial",
      dmText,
      publicReply: (b.publicReply || "").trim() || null,
      active: b.active !== false,
      adminEmail: session.email,
    },
  });
  return NextResponse.json({ success: true, campaign });
}
