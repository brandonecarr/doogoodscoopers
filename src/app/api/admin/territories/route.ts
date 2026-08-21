import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ringIsValid, ringAcres } from "@/lib/geo/home-count";

// Admin CRUD for canvassing territories (drawn polygons + home count + assignee).
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const territories = await prisma.canvassTerritory.findMany({
    where: { archived: false },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ territories });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  const name = String(b?.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name the area." }, { status: 400 });
  if (!ringIsValid(b?.polygon)) return NextResponse.json({ error: "Draw an area with at least 3 points." }, { status: 400 });

  // Resolve the assigned canvasser's name from its id (never trust the client's).
  let assignedCanvasserId: string | null = typeof b.assignedCanvasserId === "string" && b.assignedCanvasserId ? b.assignedCanvasserId : null;
  let assignedCanvasserName: string | null = null;
  if (assignedCanvasserId) {
    const c = await prisma.canvasser.findUnique({ where: { id: assignedCanvasserId } });
    if (!c) { assignedCanvasserId = null; }
    else assignedCanvasserName = c.name;
  }

  const data = {
    name,
    polygon: b.polygon,
    homeCount: Number.isFinite(b.homeCount) ? Math.max(0, Math.round(b.homeCount)) : 0,
    areaAcres: Math.round(ringAcres(b.polygon) * 10) / 10,
    color: typeof b.color === "string" && /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : "#6D3EF0",
    assignedCanvasserId,
    assignedCanvasserName,
  };

  const territory = b.id
    ? await prisma.canvassTerritory.update({ where: { id: String(b.id) }, data })
    : await prisma.canvassTerritory.create({ data: { ...data, createdBy: session.email } });

  return NextResponse.json({ territory });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await request.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.canvassTerritory.updateMany({ where: { id: String(id) }, data: { archived: true } });
  return NextResponse.json({ ok: true });
}
