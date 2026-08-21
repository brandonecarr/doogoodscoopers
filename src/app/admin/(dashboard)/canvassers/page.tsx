import { redirect } from "next/navigation";
import Link from "next/link";
import { Footprints, MapPinned } from "lucide-react";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PageHero } from "@/components/admin/PageHero";
import { CanvassersOverviewMap, type OverviewPin } from "@/components/admin/CanvassersOverviewMap";
import { CanvasserTeamManager } from "@/components/admin/CanvasserTeamManager";

export const dynamic = "force-dynamic";

const DISPOSITIONS = ["LEAD", "INTERESTED", "CALLBACK", "NOT_HOME", "NOT_INTERESTED", "DO_NOT_KNOCK"] as const;
const DISPO_LABEL: Record<string, string> = {
  LEAD: "Leads", INTERESTED: "Interested", CALLBACK: "Call back",
  NOT_HOME: "Not home", NOT_INTERESTED: "Not int.", DO_NOT_KNOCK: "DNK",
};

interface RosterRow {
  canvasserId: string;
  name: string;
  visits: number;
  leads: number;
  byStatus: Record<string, number>;
}

export default async function CanvassersOverviewPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const [visits, leadGroups] = await Promise.all([
    prisma.canvassVisit.findMany({
      select: { canvasserId: true, canvasserName: true, status: true, lat: true, lng: true, address: true, notes: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
    prisma.canvasserLead.groupBy({ by: ["canvasserId"], _count: { _all: true } }),
  ]);

  const leadCount = new Map<string, number>();
  for (const g of leadGroups) leadCount.set(g.canvasserId, g._count._all);

  const roster = new Map<string, RosterRow>();
  for (const v of visits) {
    let r = roster.get(v.canvasserId);
    if (!r) {
      r = { canvasserId: v.canvasserId, name: v.canvasserName || "Unknown", visits: 0, leads: leadCount.get(v.canvasserId) ?? 0, byStatus: {} };
      roster.set(v.canvasserId, r);
    }
    if (v.canvasserName && r.name === "Unknown") r.name = v.canvasserName;
    r.visits += 1;
    r.byStatus[v.status] = (r.byStatus[v.status] || 0) + 1;
  }
  // Include reps who have leads but (somehow) no visits in the window.
  for (const [id, n] of leadCount) {
    if (!roster.has(id)) roster.set(id, { canvasserId: id, name: "Unknown", visits: 0, leads: n, byStatus: {} });
  }
  const rows = [...roster.values()].sort((a, b) => b.leads - a.leads || b.visits - a.visits);

  const pins: OverviewPin[] = visits
    .filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lng))
    .map((v) => ({ lat: v.lat, lng: v.lng, status: v.status, address: v.address, canvasserName: v.canvasserName, notes: v.notes }));

  const totalVisits = visits.length;
  const totalLeads = [...leadCount.values()].reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <PageHero
        title="Canvassers"
        subtitle={`${rows.length} rep${rows.length === 1 ? "" : "s"} · ${totalVisits.toLocaleString()} doors · ${totalLeads.toLocaleString()} leads`}
        icon={
          <div className="w-11 h-11 rounded-[13px] flex items-center justify-center" style={{ background: "linear-gradient(150deg,#FCD34D,#D97706)" }}>
            <Footprints className="w-[22px] h-[22px] text-white" />
          </div>
        }
        actions={
          <Link href="/admin/canvassers/territories" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[12px] text-[13px] font-bold text-white transition-colors hover:brightness-110" style={{ background: "#8B6BFF" }}>
            <MapPinned className="w-4 h-4" /> Territories
          </Link>
        }
      />

      {/* Account management — add/invite canvassers, resend, deactivate */}
      <CanvasserTeamManager />

      {rows.length === 0 ? (
        <div className="dgs-card p-8 text-center">
          <Footprints className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-[13.5px] text-muted">No canvassing activity yet. Add a canvasser above — once they set their password and start dropping pins, their activity shows up here.</p>
        </div>
      ) : (
        <>
          {/* Roster */}
          <div className="dgs-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Canvasser</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Doors</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Leads</th>
                    {DISPOSITIONS.map((d) => (
                      <th key={d} className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">{DISPO_LABEL[d]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r.canvasserId} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-semibold text-navy-900">{r.name}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-navy-900">{r.visits.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold text-green-700">{r.leads.toLocaleString()}</td>
                      {DISPOSITIONS.map((d) => (
                        <td key={d} className="px-3 py-2.5 text-right tabular-nums text-gray-500 hidden sm:table-cell">{r.byStatus[d] || 0}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Map */}
          <CanvassersOverviewMap token={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} pins={pins} />
        </>
      )}
    </div>
  );
}
