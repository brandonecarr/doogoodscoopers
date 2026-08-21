import { redirect } from "next/navigation";
import { getCanvasserSession } from "@/lib/canvasser-auth";
import prisma from "@/lib/prisma";
import { CanvasserVisitsList, type VisitItem } from "@/components/portals/canvasser/CanvasserVisitsList";

export const dynamic = "force-dynamic";

export default async function CanvasserListPage() {
  const session = await getCanvasserSession();
  if (!session) redirect("/canvasser/login");

  const rows = await prisma.canvassVisit.findMany({
    where: { canvasserId: session.id },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const visits: VisitItem[] = rows.map((v) => ({
    id: v.id,
    address: v.address,
    city: v.city,
    zipCode: v.zipCode,
    status: v.status,
    notes: v.notes,
    aiNotes: v.aiNotes,
    lat: v.lat,
    lng: v.lng,
    createdAt: v.createdAt.toISOString(),
  }));

  return <CanvasserVisitsList visits={visits} />;
}
