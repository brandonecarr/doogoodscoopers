import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DEFAULT_COLUMNS } from "@/lib/kanban";

export const dynamic = "force-dynamic";

/** All boards, with column and card counts. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const boards = await prisma.kanbanBoard.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      columns: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, isDone: true } },
      _count: { select: { cards: true } },
    },
  });
  return NextResponse.json({ boards: boards.map((b) => ({ id: b.id, name: b.name, columns: b.columns, cardCount: b._count.cards })) });
}

/** New board, starting with To do / In progress / Done (all editable). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 60);
  if (!name) return NextResponse.json({ error: "Give the board a name" }, { status: 400 });
  const last = await prisma.kanbanBoard.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const board = await prisma.kanbanBoard.create({
    data: {
      name,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      columns: { create: DEFAULT_COLUMNS.map((c, i) => ({ ...c, sortOrder: i })) },
    },
  });
  return NextResponse.json({ board });
}
