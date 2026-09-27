import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateKey, hashKey } from "@/lib/tv-connector";

export const dynamic = "force-dynamic";

/** Connector keys for Apple TVs (never the raw key; that's shown once on creation). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const keys = await prisma.tvConnectorKey.findMany({
    where: { revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, keyPreview: true, createdAt: true, lastUsedAt: true },
  });
  return NextResponse.json({ keys });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const label = String(b.label ?? "").trim().slice(0, 60) || "Office TV";

  const raw = generateKey();
  const key = await prisma.tvConnectorKey.create({
    data: { label, keyHash: hashKey(raw), keyPreview: raw.slice(-4) },
    select: { id: true, label: true, keyPreview: true, createdAt: true, lastUsedAt: true },
  });
  return NextResponse.json({ key, raw });
}

/** Revoke: the TV using it stops getting data on its next refresh. */
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await prisma.tvConnectorKey.update({ where: { id: String(b.id) }, data: { revokedAt: new Date() } }).catch(() => null);
  return NextResponse.json({ success: true });
}
