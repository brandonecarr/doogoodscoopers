import { redirect } from "next/navigation";
import { Megaphone, Sparkles, CheckCircle2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isMarketingDirectorConfigured } from "@/lib/marketing-director";
import { PageHero } from "@/components/admin/PageHero";
import { MarketingTaskList, type MarketingTaskItem } from "@/components/admin/MarketingTaskList";
import { GenerateMarketingPlanButton } from "@/components/admin/GenerateMarketingPlanButton";

export const dynamic = "force-dynamic";

function weekLabel(d: Date) {
  const end = new Date(d.getTime() + 6 * 24 * 60 * 60 * 1000);
  const f = (x: Date) => x.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `Week of ${f(d)} – ${f(end)}`;
}

export default async function MarketingPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const configured = isMarketingDirectorConfigured();
  const plan = await prisma.marketingPlan.findFirst({
    orderBy: { weekOf: "desc" },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
  });

  const tasks: MarketingTaskItem[] = (plan?.tasks ?? []).map((t) => ({
    id: t.id, title: t.title, detail: t.detail, channel: t.channel,
    dayHint: t.dayHint, effort: t.effort, priority: t.priority, rationale: t.rationale, status: t.status,
    caption: t.caption, studioDraftId: t.studioDraftId,
  }));
  const done = tasks.filter((t) => t.status === "DONE").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <PageHero
        title="Marketing"
        subtitle={plan ? `Your AI marketing director · ${weekLabel(plan.weekOf)}` : "Your AI marketing director"}
        icon={
          <div className="w-11 h-11 rounded-[13px] bg-white/10 flex items-center justify-center">
            <Megaphone className="w-[22px] h-[22px] text-white" />
          </div>
        }
        actions={plan ? <GenerateMarketingPlanButton regenerate /> : undefined}
      />

      {!configured && (
        <div className="dgs-card p-4" style={{ background: "#FEF6E7" }}>
          <p className="text-[13px] text-[#854F0B]">
            The marketing AI needs an <code>ANTHROPIC_API_KEY</code> in your Vercel environment to write plans. Once it&apos;s set, plans generate automatically every Monday.
          </p>
        </div>
      )}

      {!plan ? (
        /* Empty state */
        <div className="dgs-card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4" style={{ background: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}>
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-[18px] font-extrabold text-ink">Meet your marketing director</h2>
          <p className="text-[13.5px] text-muted mt-2 max-w-md mx-auto">
            A seasoned AI marketer studies your real numbers — signups, churn, cities, season — and hands you a fresh, checkable to-do list every week: what to post, who to reach, and how to grow. It runs automatically each Monday.
          </p>
          <div className="mt-5 flex justify-center">{configured && <GenerateMarketingPlanButton />}</div>
        </div>
      ) : (
        <>
          {/* This week's briefing */}
          <div className="dgs-hero p-[22px] sm:p-[26px]">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-[#C8B9FF]" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#C8B9FF]">This week&apos;s focus</span>
            </div>
            <h2 className="text-[22px] font-extrabold text-white tracking-[-0.02em]">{plan.theme}</h2>
            <p className="text-[13.5px] text-[#C9C9D6] mt-2 leading-relaxed max-w-3xl">{plan.summary}</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 max-w-xs h-2 rounded-full bg-white/15 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "#8B6BFF" }} />
              </div>
              <span className="text-[12px] text-white/80 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> {done}/{tasks.length} done
              </span>
            </div>
          </div>

          {/* Task list */}
          <MarketingTaskList tasks={tasks} />
        </>
      )}
    </div>
  );
}
