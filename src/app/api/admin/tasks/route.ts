import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { fromDateInputValue } from "@/lib/datetime";

export const dynamic = "force-dynamic";

const TASK_STATUSES = ["TODO", "DOING", "DONE"] as const;

/** Open tasks plus anything finished in the last 30 days. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tasks = await prisma.task.findMany({
    where: { OR: [{ status: { in: ["TODO", "DOING"] } }, { doneAt: { gte: new Date(Date.now() - 30 * 86_400_000) } }] },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));

  const title = String(b.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Give the task a title" }, { status: 400 });
  const status = TASK_STATUSES.includes(b.status) ? b.status : "TODO";

  // New tasks go to the bottom of their column.
  const last = await prisma.task.findFirst({ where: { status }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const task = await prisma.task.create({
    data: {
      title: title.slice(0, 200),
      notes: b.notes ? String(b.notes).slice(0, 4000) : null,
      tag: b.tag ? String(b.tag).trim().slice(0, 40) : null,
      owner: b.owner ? String(b.owner).trim().slice(0, 60) : null,
      dueOn: b.dueOn ? new Date(fromDateInputValue(String(b.dueOn))!) : null,
      status,
      doneAt: status === "DONE" ? new Date() : null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json({ task });
}
