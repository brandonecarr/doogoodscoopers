import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET → full draft (with data). DELETE → remove it.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const draft = await prisma.studioDraft.findUnique({ where: { id } });
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ draft });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.studioDraft.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
