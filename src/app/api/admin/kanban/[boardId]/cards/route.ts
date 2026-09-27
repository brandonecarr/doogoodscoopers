import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { cardFields } from "@/lib/kanban";

export const dynamic = "force-dynamic";

/** Adds a card to the bottom of a column. */
export async function POST(request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const boardId = (await params).boardId;
  const b = await request.json().catch(() => ({}));
  const column = await prisma.kanbanColumn.findFirst({ where: { id: String(b.columnId ?? ""), boardId }, select: { id: true } });
  if (!column) return NextResponse.json({ error: "Column not found" }, { status: 404 });
  try {
    const fields = cardFields({ ...b, title: b.title ?? "" });
    const last = await prisma.kanbanCard.findFirst({ where: { columnId: column.id }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    const card = await prisma.kanbanCard.create({ data: { ...fields, title: fields.title!, boardId, columnId: column.id, sortOrder: (last?.sortOrder ?? -1) + 1 } });
    return NextResponse.json({ card });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
