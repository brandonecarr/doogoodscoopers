import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET → recent notifications + unread count for the header bell.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [notifications, unread] = await Promise.all([
    prisma.adminNotification.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.adminNotification.count({ where: { readAt: null } }),
  ]);
  return NextResponse.json({ notifications, unread });
}

// POST { id } marks one read; { all: true } marks everything read.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, all } = await request.json().catch(() => ({}));
  if (all) {
    await prisma.adminNotification.updateMany({ where: { readAt: null }, data: { readAt: new Date() } });
  } else if (id) {
    await prisma.adminNotification.update({ where: { id }, data: { readAt: new Date() } }).catch(() => {});
  } else {
    return NextResponse.json({ error: "Pass an id or all:true" }, { status: 400 });
  }
  const unread = await prisma.adminNotification.count({ where: { readAt: null } });
  return NextResponse.json({ success: true, unread });
}
