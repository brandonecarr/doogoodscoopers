import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const segments = await prisma.emailSegment.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ segments });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json();
  if (!b.name?.trim() || !b.filter) return NextResponse.json({ error: "Name and filter required." }, { status: 400 });
  const segment = await prisma.emailSegment.create({ data: { name: b.name.trim(), filter: b.filter, adminEmail: session.email } });
  return NextResponse.json({ success: true, segment });
}
