import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCanvasserSession } from "@/lib/canvasser-auth";

// The territories assigned to the signed-in canvasser (drawn on their map).
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCanvasserSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const territories = await prisma.canvassTerritory.findMany({
    where: { assignedCanvasserId: user.id, archived: false },
    select: { id: true, name: true, polygon: true, homeCount: true, color: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ territories });
}
