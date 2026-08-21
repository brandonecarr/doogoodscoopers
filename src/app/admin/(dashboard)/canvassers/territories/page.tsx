import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPinned } from "lucide-react";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PageHero } from "@/components/admin/PageHero";
import { TerritoryPlanner, type Territory } from "@/components/admin/TerritoryPlanner";

export const dynamic = "force-dynamic";

export default async function TerritoriesPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const [rows, canvassers] = await Promise.all([
    prisma.canvassTerritory.findMany({ where: { archived: false }, orderBy: { createdAt: "desc" } }),
    prisma.canvasser.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const territories: Territory[] = rows.map((t) => ({
    id: t.id,
    name: t.name,
    polygon: (t.polygon as [number, number][]) ?? [],
    homeCount: t.homeCount,
    areaAcres: t.areaAcres,
    color: t.color,
    assignedCanvasserId: t.assignedCanvasserId,
    assignedCanvasserName: t.assignedCanvasserName,
  }));

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <PageHero
        title="Canvassing Territories"
        subtitle="Outline a neighborhood to get its home count, then assign it to a canvasser"
        icon={
          <div className="w-11 h-11 rounded-[13px] flex items-center justify-center" style={{ background: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}>
            <MapPinned className="w-[22px] h-[22px] text-white" />
          </div>
        }
        actions={
          <Link href="/admin/canvassers" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[12px] text-[13px] font-semibold bg-white/10 text-white hover:bg-white/15 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Canvassers
          </Link>
        }
      />
      <TerritoryPlanner token={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} canvassers={canvassers} initial={territories} />
    </div>
  );
}
