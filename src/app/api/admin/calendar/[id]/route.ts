import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Manual calendar entries only. Follow-up events are edited on the lead itself,
// so they never reach these handlers.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
      data.title = title;
    }
    if (body.startAt !== undefined) {
      const startAt = new Date(body.startAt);
      if (isNaN(startAt.getTime())) return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
      data.startAt = startAt;
    }
    if (body.endAt !== undefined) {
      if (body.endAt === null || body.endAt === "") {
        data.endAt = null;
      } else {
        const endAt = new Date(body.endAt);
        if (isNaN(endAt.getTime())) return NextResponse.json({ error: "Invalid end date" }, { status: 400 });
        data.endAt = endAt;
      }
    }
    if (body.allDay !== undefined) data.allDay = !!body.allDay;
    if (body.notes !== undefined) data.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
    if (body.location !== undefined) data.location = typeof body.location === "string" && body.location.trim() ? body.location.trim() : null;
    if (body.color !== undefined) data.color = typeof body.color === "string" && body.color.trim() ? body.color.trim() : null;

    // Guard: end must be after start when both are known post-update.
    if (data.startAt || data.endAt) {
      const existing = await prisma.calendarEntry.findUnique({ where: { id }, select: { startAt: true, endAt: true } });
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const s = (data.startAt as Date) ?? existing.startAt;
      const e = data.endAt !== undefined ? (data.endAt as Date | null) : existing.endAt;
      if (e && e < s) return NextResponse.json({ error: "End must be after start" }, { status: 400 });
    }

    await prisma.calendarEntry.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating calendar entry:", error);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    await prisma.calendarEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting calendar entry:", error);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
