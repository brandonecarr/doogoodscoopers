import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { fromDateInputValue } from "@/lib/datetime";

export const dynamic = "force-dynamic";

const STATUSES = ["TODO", "DOING", "DONE"];

/** Edit fields, or move: send `status` and/or `sortOrder`. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await request.json().catch(() => ({}));

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (b.title !== undefined) {
    const title = String(b.title).trim();
    if (!title) return NextResponse.json({ error: "Title can't be empty" }, { status: 400 });
    data.title = title.slice(0, 200);
  }
  if (b.notes !== undefined) data.notes = b.notes ? String(b.notes).slice(0, 4000) : null;
  if (b.tag !== undefined) data.tag = b.tag ? String(b.tag).trim().slice(0, 40) : null;
  if (b.owner !== undefined) data.owner = b.owner ? String(b.owner).trim().slice(0, 60) : null;
  if (b.dueOn !== undefined) data.dueOn = b.dueOn ? new Date(fromDateInputValue(String(b.dueOn))!) : null;
  if (b.sortOrder !== undefined && Number.isFinite(Number(b.sortOrder))) data.sortOrder = Number(b.sortOrder);
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return NextResponse.json({ error: "Unknown status" }, { status: 400 });
    data.status = b.status;
    if (b.status === "DONE" && existing.status !== "DONE") data.doneAt = new Date();
    if (b.status !== "DONE") data.doneAt = null;
  }

  const task = await prisma.task.update({ where: { id }, data });
  return NextResponse.json({ task });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.task.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ success: true });
}
