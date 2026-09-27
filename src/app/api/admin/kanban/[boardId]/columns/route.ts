import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { columnFields } from "@/lib/kanban";

export const dynamic = "force-dynamic";

/** Adds a column at the right end of the board. */
export async function POST(request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const boardId = (await params).boardId;
  const b = await request.json().catch(() => ({}));
  try {
    const fields = columnFields({ name: b.name, color: b.color, isDone: b.isDone });
    const last = await prisma.kanbanColumn.findFirst({ where: { boardId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    const column = await prisma.kanbanColumn.create({ data: { boardId, name: fields.name!, color: fields.color ?? null, isDone: fields.isDone ?? false, sortOrder: (last?.sortOrder ?? -1) + 1 } });
    return NextResponse.json({ column });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
