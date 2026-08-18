import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Public: start a funnel session (one visitor run). Returns a sessionId the
// renderer uses to log per-step events and tie the eventual lead back.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}));
  if (!b.funnelId || !b.slug) {
    return NextResponse.json({ error: "funnelId and slug are required" }, { status: 400 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const ua = request.headers.get("user-agent") || null;
  const attribution = { ...(b.attribution && typeof b.attribution === "object" ? b.attribution : {}), ip, ua };
  const s = await prisma.funnelSession.create({
    data: { funnelId: String(b.funnelId), slug: String(b.slug), variant: b.variant === "B" ? "B" : "A", attribution },
  });
  return NextResponse.json({ sessionId: s.id });
}
