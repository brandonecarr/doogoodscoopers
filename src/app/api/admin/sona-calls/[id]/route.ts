import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { refreshSonaCall, SONA_FINAL } from "@/lib/sona-calls";

/** GET → refresh from Quo (if still running) and return the call. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const row = await prisma.sonaCall.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!SONA_FINAL.has(row.status) && row.agentCallId) {
    try { await refreshSonaCall(id); } catch (e) { return NextResponse.json({ call: row, refreshError: e instanceof Error ? e.message : String(e) }); }
  }
  return NextResponse.json({ call: await prisma.sonaCall.findUnique({ where: { id } }) });
}
