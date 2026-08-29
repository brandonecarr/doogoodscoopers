import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Past scans, newest first. Every scan has always been stored — this just makes
// the history readable so runs can be compared over time.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cityId = new URL(request.url).searchParams.get("cityId");

  const scans = await prisma.rankGridScan.findMany({
    where: cityId ? { cityId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ scans });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.rankGridPoint.deleteMany({ where: { scanId: id } });
  await prisma.rankGridScan.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
