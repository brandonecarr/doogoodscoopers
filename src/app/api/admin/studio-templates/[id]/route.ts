import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// DELETE → hide a trending template (soft-remove so it can't be regenerated
// into the same slot and clutter the gallery).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.studioTemplate.update({ where: { id }, data: { active: false } }).catch(() => {});
  return NextResponse.json({ success: true });
}
