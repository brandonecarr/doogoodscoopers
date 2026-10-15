/** Saved sections for the email designer: list, save, rename, delete. */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sections = await prisma.emailSavedSection.findMany({ orderBy: { updatedAt: "desc" }, take: 100 });
  return NextResponse.json({ sections });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { name?: string; section?: unknown };
  const name = (b.name || "").trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "Name the section" }, { status: 400 });
  if (!b.section || typeof b.section !== "object" || !Array.isArray((b.section as { columns?: unknown }).columns)) {
    return NextResponse.json({ error: "Not a section" }, { status: 400 });
  }
  const saved = await prisma.emailSavedSection.create({ data: { name, section: b.section as Prisma.InputJsonValue, adminEmail: session.email } });
  return NextResponse.json({ section: saved });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { id?: string; name?: string };
  const name = (b.name || "").trim().slice(0, 80);
  if (!b.id || !name) return NextResponse.json({ error: "id and name required" }, { status: 400 });
  const saved = await prisma.emailSavedSection.update({ where: { id: b.id }, data: { name } });
  return NextResponse.json({ section: saved });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.emailSavedSection.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ success: true });
}
