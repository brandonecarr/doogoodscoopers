import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Reusable SMS templates for the per-lead compose box and campaigns.

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  const templates = await prisma.messageTemplate.findMany({
    where: category ? { category } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, body, category } = await request.json();
  if (!name || !body) {
    return NextResponse.json({ error: "Name and body are required" }, { status: 400 });
  }

  const template = await prisma.messageTemplate.create({
    data: { name, body, category: category || "general", adminEmail: session.email },
  });
  return NextResponse.json({ success: true, template });
}
