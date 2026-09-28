import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// List + add competitors the keyword agent should study.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const competitors = await prisma.keywordCompetitor.findMany({ orderBy: [{ active: "desc" }, { sortOrder: "asc" }] });
  return NextResponse.json({ competitors });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const website = typeof body.website === "string" && body.website.trim() ? body.website.trim().replace(/^https?:\/\//, "") : null;
  const max = await prisma.keywordCompetitor.aggregate({ _max: { sortOrder: true } });
  const c = await prisma.keywordCompetitor.create({
    data: { name, website, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json({ ok: true, id: c.id });
}
