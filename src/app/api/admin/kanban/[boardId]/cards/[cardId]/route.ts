import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { cardFields } from "@/lib/kanban";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ boardId: string; cardId: string }> };

/** Edit a card; send `columnId` to move it (it goes to the bottom of that column). */
export async function PATCH(request: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { boardId, cardId } = await params;
  const b = await request.json().catch(() => ({}));
  try {
    const data: Record<string, unknown> = cardFields(b);
    if (b.columnId !== undefined) {
      const column = await prisma.kanbanColumn.findFirst({ where: { id: String(b.columnId), boardId }, select: { id: true } });
      if (!column) return NextResponse.json({ error: "Column not found" }, { status: 404 });
      const last = await prisma.kanbanCard.findFirst({ where: { columnId: column.id }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
      data.columnId = column.id;
      data.sortOrder = (last?.sortOrder ?? -1) + 1;
    }
    const result = await prisma.kanbanCard.updateMany({ where: { id: cardId, boardId }, data });
    if (!result.count) return NextResponse.json({ error: "Card not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { boardId, cardId } = await params;
  await prisma.kanbanCard.deleteMany({ where: { id: cardId, boardId } });
  return NextResponse.json({ success: true });
}
