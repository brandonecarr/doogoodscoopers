import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { name, body, category } = await request.json();
  if (!name || !body) {
    return NextResponse.json({ error: "Name and body are required" }, { status: 400 });
  }

  const template = await prisma.messageTemplate.update({
    where: { id },
    data: { name, body, ...(category ? { category } : {}) },
  });
  return NextResponse.json({ success: true, template });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.messageTemplate.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
