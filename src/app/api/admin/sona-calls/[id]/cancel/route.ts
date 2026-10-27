import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { cancelSonaCall } from "@/lib/sona-calls";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await prisma.sonaCall.findUnique({ where: { id }, select: { id: true } }))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await cancelSonaCall(id);
  return NextResponse.json({ ok: true, call: await prisma.sonaCall.findUnique({ where: { id } }) });
}
