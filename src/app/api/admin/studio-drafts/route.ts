import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET → list saved drafts (metadata only). POST → create or update a draft.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const drafts = await prisma.studioDraft.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, updatedAt: true },
  });
  return NextResponse.json({ drafts });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, name, data } = await request.json();
  if (!name || !data) return NextResponse.json({ error: "name and data are required" }, { status: 400 });

  const draft = id
    ? await prisma.studioDraft.update({ where: { id }, data: { name, data } })
    : await prisma.studioDraft.create({ data: { name, data } });
  return NextResponse.json({ id: draft.id, name: draft.name });
}
