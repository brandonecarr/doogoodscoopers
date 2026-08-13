import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Toggle a marketing task complete/incomplete.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const done = body?.status === "DONE" || body?.done === true;

  const task = await prisma.marketingTask.update({
    where: { id },
    data: { status: done ? "DONE" : "TODO", completedAt: done ? new Date() : null },
  });
  return NextResponse.json({ success: true, status: task.status });
}
