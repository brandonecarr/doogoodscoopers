import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Public: log a single per-step funnel event (view / answer / next / back /
// handoff / abandon). Fire-and-forget from the renderer (sendBeacon for abandon).
export const dynamic = "force-dynamic";

const TYPES = new Set(["view", "answer", "next", "back", "submit", "abandon", "handoff", "outofarea"]);

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}));
  if (!b.sessionId || !b.funnelId || !b.step || !TYPES.has(b.type)) {
    return NextResponse.json({ error: "invalid event" }, { status: 400 });
  }
  await prisma.funnelEvent.create({
    data: {
      sessionId: String(b.sessionId),
      funnelId: String(b.funnelId),
      variant: b.variant === "B" ? "B" : "A",
      step: String(b.step),
      type: String(b.type),
      payload: b.payload && typeof b.payload === "object" ? b.payload : undefined,
    },
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
