import Link from "next/link";
import { redirect } from "next/navigation";
import { Split, ExternalLink, Pencil, BarChart3 } from "lucide-react";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PageHero } from "@/components/admin/PageHero";
import { NewFunnelButton } from "@/components/admin/funnels/NewFunnelButton";
import { DeleteFunnelButton } from "@/components/admin/funnels/DeleteFunnelButton";

export const dynamic = "force-dynamic";

function fmt(d: Date) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function FunnelsPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const funnels = await prisma.funnel.findMany({
    select: { id: true, slug: true, name: true, status: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <PageHero
        title="Funnels"
        subtitle="Build multi-step lead funnels — questions, instant Sweep&Go pricing, and a booking handoff"
        icon={
          <div className="w-11 h-11 rounded-[13px] flex items-center justify-center" style={{ background: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}>
            <Split className="w-[22px] h-[22px] text-white" />
          </div>
        }
        actions={<NewFunnelButton />}
      />

      {funnels.length === 0 ? (
        <div className="dgs-card p-8 text-center">
          <Split className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-[13.5px] text-muted">No funnels yet. Create one — you&apos;ll get a starter ZIP → contact → thank-you flow to edit.</p>
        </div>
      ) : (
        <div className="dgs-card overflow-hidden">
          <div className="divide-y divide-gray-100">
            {funnels.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-navy-900 truncate">{f.name}</p>
                  <p className="text-[12px] text-gray-500">/f/{f.slug} · updated {fmt(f.updatedAt)}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${f.status === "published" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>{f.status}</span>
                {f.status === "published" && (
                  <a href={`/f/${f.slug}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="View live"><ExternalLink className="w-4 h-4" /></a>
                )}
                <Link href={`/admin/funnels/${f.id}/analytics`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Analytics"><BarChart3 className="w-4 h-4" /></Link>
                <Link href={`/admin/funnels/${f.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold text-white" style={{ background: "#6D3EF0" }}><Pencil className="w-3.5 h-3.5" /> Edit</Link>
                <DeleteFunnelButton id={f.id} name={f.name} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
