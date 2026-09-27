import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { columnFields } from "@/lib/kanban";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ boardId: string; columnId: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { boardId, columnId } = await params;
  try {
    const data = columnFields(await request.json().catch(() => ({})));
    const result = await prisma.kanbanColumn.updateMany({ where: { id: columnId, boardId }, data });
    if (!result.count) return NextResponse.json({ error: "Column not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

/** Deletes a column and its cards. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { boardId, columnId } = await params;
  await prisma.kanbanColumn.deleteMany({ where: { id: columnId, boardId } });
  return NextResponse.json({ success: true });
}
