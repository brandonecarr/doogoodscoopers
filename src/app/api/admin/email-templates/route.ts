import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const full = new URL(request.url).searchParams.get("full") === "1";
  const templates = await prisma.emailTemplate.findMany({
    orderBy: { updatedAt: "desc" },
    ...(full ? {} : { select: { id: true, name: true, subject: true, category: true, updatedAt: true } }),
  });
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json();
  if (!b.name?.trim() || !b.html?.trim()) return NextResponse.json({ error: "Name and design are required." }, { status: 400 });
  const template = await prisma.emailTemplate.create({
    data: {
      name: b.name.trim(),
      subject: b.subject?.trim() || null,
      html: b.html,
      designJson: b.designJson ?? undefined,
      category: b.category || null,
      adminEmail: session.email,
    },
  });
  return NextResponse.json({ success: true, template });
}
