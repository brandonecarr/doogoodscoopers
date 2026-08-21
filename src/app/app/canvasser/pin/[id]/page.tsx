import { redirect, notFound } from "next/navigation";
import { getCanvasserSession } from "@/lib/canvasser-auth";
import prisma from "@/lib/prisma";
import { PinDetail, type PinData } from "@/components/portals/canvasser/PinDetail";

export const dynamic = "force-dynamic";

export default async function PinDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCanvasserSession();
  if (!session) redirect("/canvasser/login");
  const { id } = await params;

  const v = await prisma.canvassVisit.findUnique({ where: { id } });
  if (!v || v.canvasserId !== session.id) notFound();

  const pin: PinData = {
    id: v.id,
    clientKey: v.clientKey,
    lat: v.lat,
    lng: v.lng,
    address: v.address,
    city: v.city,
    zipCode: v.zipCode,
    status: v.status,
    notes: v.notes,
    aiNotes: v.aiNotes,
    canvasserLeadId: v.canvasserLeadId,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };

  return <PinDetail pin={pin} />;
}
