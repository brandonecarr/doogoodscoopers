import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { FunnelData } from "@/lib/funnel/types";
import { PageHero } from "@/components/admin/PageHero";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ days?: string }>;
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
const fmtInt = (n: number) => n.toLocaleString();

export default async function FunnelAnalyticsPage({ params, searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const { id } = await params;
  const { days: daysRaw } = await searchParams;
  const days = daysRaw === "0" ? 0 : parseInt(daysRaw || "30") || 30;
  const cutoff = days > 0 ? new Date(Date.now() - days * 86_400_000) : new Date(0);

  const funnel = await prisma.funnel.findUnique({ where: { id } });
  if (!funnel) notFound();
  const data = funnel.data as unknown as FunnelData;
  const steps = data.variants.A.steps;

  const [sessions, completed, leadGroups, stepRows, specialRows] = await Promise.all([
    prisma.funnelSession.count({ where: { funnelId: id, startedAt: { gte: cutoff } } }),
    prisma.funnelSession.count({ where: { funnelId: id, startedAt: { gte: cutoff }, completedAt: { not: null } } }),
    prisma.funnelSession.groupBy({ by: ["leadType"], where: { funnelId: id, startedAt: { gte: cutoff }, leadType: { not: null } }, _count: { _all: true } }),
    prisma.$queryRaw<{ step: string; sessions: number }[]>`
      SELECT step, COUNT(DISTINCT "sessionId")::int AS sessions
      FROM "FunnelEvent" WHERE "funnelId" = ${id} AND type = 'view' AND "createdAt" >= ${cutoff}
      GROUP BY step`,
    prisma.$queryRaw<{ type: string; sessions: number }[]>`
      SELECT type, COUNT(DISTINCT "sessionId")::int AS sessions
      FROM "FunnelEvent" WHERE "funnelId" = ${id} AND type IN ('handoff','outofarea') AND "createdAt" >= ${cutoff}
      GROUP BY type`,
  ]);

  const stepMap = new Map(stepRows.map((r) => [r.step, r.sessions]));
  const special = new Map(specialRows.map((r) => [r.type, r.sessions]));
  const quoteLeads = leadGroups.find((g) => g.leadType === "quote")?._count._all ?? 0;
  const ooaLeads = leadGroups.find((g) => g.leadType === "outofarea")?._count._all ?? 0;
  const handoffs = special.get("handoff") ?? 0;

  const funnelSteps = steps.map((s, i) => {
    const reached = stepMap.get(s.id) ?? 0;
    const prev = i === 0 ? sessions : (stepMap.get(steps[i - 1].id) ?? 0);
    return { id: s.id, name: s.name, reached, dropFromPrev: prev > 0 ? Math.max(0, prev - reached) : 0, dropPct: prev > 0 ? Math.round((1 - reached / prev) * 100) : 0 };
  });
  const topReach = Math.max(sessions, ...funnelSteps.map((s) => s.reached), 1);

  const dayOpt = (v: number, label: string) => (
    <Link href={`?days=${v}`} className="px-2.5 py-1 rounded-lg text-[12px] font-semibold"
      style={days === v ? { background: "#6D3EF0", color: "#fff" } : { background: "#F4F4F6", color: "#5A5A66" }}>{label}</Link>
  );

  const tile = (label: string, value: string, sub?: string) => (
    <div className="dgs-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="text-[26px] font-extrabold text-ink mt-0.5">{value}</p>
      {sub && <p className="text-[12px] text-muted mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <PageHero title="Funnel analytics" subtitle={`${funnel.name} · /f/${funnel.slug}`} backHref={`/admin/funnels/${id}`}
        actions={<div className="flex items-center gap-1.5">{dayOpt(30, "30d")}{dayOpt(90, "90d")}{dayOpt(0, "All")}</div>} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {tile("Sessions", fmtInt(sessions))}
        {tile("Completed", fmtInt(completed), `${pct(completed, sessions)}% completion`)}
        {tile("Quote leads", fmtInt(quoteLeads))}
        {tile("Out of area", fmtInt(ooaLeads))}
        {tile("Booking clicks", fmtInt(handoffs), `${pct(handoffs, completed)}% of completed`)}
      </div>

      <div className="dgs-card p-4">
        <h2 className="text-[13px] font-bold text-ink mb-3">Step-by-step drop-off</h2>
        {sessions === 0 ? (
          <p className="text-[13px] text-muted">No sessions in this window yet. Share the funnel and check back.</p>
        ) : (
          <div className="space-y-2.5">
            {funnelSteps.map((s, i) => (
              <div key={s.id}>
                <div className="flex items-center justify-between text-[12.5px] mb-1">
                  <span className="font-semibold text-ink">{i + 1}. {s.name}</span>
                  <span className="text-muted tabular-nums">{fmtInt(s.reached)} · {pct(s.reached, sessions)}% of start{i > 0 && s.dropPct > 0 ? ` · −${s.dropPct}% from prev` : ""}</span>
                </div>
                <div className="h-6 rounded-lg bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-lg transition-all" style={{ width: `${pct(s.reached, topReach)}%`, background: "#8B6BFF" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
