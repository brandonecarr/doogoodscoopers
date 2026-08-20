import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Admin: fetch one funnel (full data) or delete it.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const funnel = await prisma.funnel.findUnique({ where: { id } });
  if (!funnel) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ funnel });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    // Clear the funnel's analytics rows (plain funnelId columns, no FK), then the funnel.
    await prisma.funnelEvent.deleteMany({ where: { funnelId: id } });
    await prisma.funnelSession.deleteMany({ where: { funnelId: id } });
    await prisma.funnel.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Couldn't delete the funnel." }, { status: 500 });
  }
}
