import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { loadBoard } from "@/lib/kanban";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ boardId: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const board = await loadBoard((await params).boardId);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });
  return NextResponse.json({ board });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 60);
  if (!name) return NextResponse.json({ error: "Give the board a name" }, { status: 400 });
  const board = await prisma.kanbanBoard.update({ where: { id: (await params).boardId }, data: { name } }).catch(() => null);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });
  return NextResponse.json({ board });
}

/** Deletes the board with all its columns and cards. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.kanbanBoard.delete({ where: { id: (await params).boardId } }).catch(() => null);
  return NextResponse.json({ success: true });
}

/**
 * Saves the whole arrangement after a drag: column order, and each column's cards in order.
 * Body: { columns: [{ id, cardIds: [...] }, ...] }. Ids from other boards are ignored.
 */
export async function PUT(request: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const boardId = (await params).boardId;
  const b = await request.json().catch(() => ({}));
  const columns: { id: string; cardIds: string[] }[] = Array.isArray(b.columns) ? b.columns : [];

  const board = await loadBoard(boardId);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });
  const columnIds = new Set(board.columns.map((c) => c.id));
  const cardIds = new Set(board.cards.map((c) => c.id));

  const updates = columns
    .filter((c) => columnIds.has(c.id))
    .flatMap((c, ci) => [
      prisma.kanbanColumn.update({ where: { id: c.id }, data: { sortOrder: ci } }),
      ...(Array.isArray(c.cardIds) ? c.cardIds : [])
        .filter((id) => cardIds.has(id))
        .map((id, i) => prisma.kanbanCard.update({ where: { id }, data: { columnId: c.id, sortOrder: i } })),
    ]);
  await prisma.$transaction(updates);
  return NextResponse.json({ board: await loadBoard(boardId) });
}
