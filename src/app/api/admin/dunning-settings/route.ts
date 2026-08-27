import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getSetting, setSetting } from "@/lib/google-business";

// Failed-payment recovery: on/off, the payment link, and what's currently owed.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - 90 * 86_400_000);
  const [enabled, payLink, lastRun, outstanding] = await Promise.all([
    getSetting("dunning.enabled"),
    getSetting("dunning.payLink"),
    getSetting("dunning.lastRun"),
    prisma.sngInvoice.aggregate({
      where: { remainingCents: { gt: 0 }, dunningResolvedAt: null, sngCreatedAt: { gte: since } },
      _sum: { remainingCents: true },
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    enabled: enabled === "true",
    payLink: payLink || "",
    lastRun: lastRun || null,
    outstandingCount: outstanding._count._all,
    outstandingCents: outstanding._sum.remainingCents || 0,
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (typeof b.enabled === "boolean") await setSetting("dunning.enabled", b.enabled ? "true" : "false");
  if (typeof b.payLink === "string") await setSetting("dunning.payLink", b.payLink.trim().slice(0, 500));
  return NextResponse.json({ ok: true });
}
