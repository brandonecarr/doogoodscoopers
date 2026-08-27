import prisma from "@/lib/prisma";
import { Users, UserPlus, UserMinus, TrendingUp, DollarSign, FileText } from "lucide-react";
import { GrowthChart, type GrowthPoint } from "./GrowthChart";
import { MrrChart } from "./MrrChart";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH_LABELS[m - 1]} '${String(y).slice(2)}`;
};
const ym = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

/** Every YYYY-MM from `start` through `end` inclusive, so the lines stay continuous. */
function monthRange(start: string, end: string): string[] {
  const out: string[] = [];
  let [y, m] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

function Stat({ icon: Icon, label, value, sub, tone = "ink" }: {
  icon: typeof Users; label: string; value: string; sub?: string; tone?: "ink" | "up" | "down" | "iris";
}) {
  const color = tone === "up" ? "#16A34A" : tone === "down" ? "#F43F5E" : tone === "iris" ? "#6D3EF0" : "#101014";
  return (
    <div className="dgs-card p-4">
      <div className="flex items-center gap-2 text-muted mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-[12px] font-medium">{label}</span>
      </div>
      <p className="text-[26px] font-extrabold leading-none tracking-[-0.02em]" style={{ color }}>{value}</p>
      {sub && <p className="text-[11.5px] text-muted mt-1.5">{sub}</p>}
    </div>
  );
}

export async function CustomerGrowthDashboard() {
  const events = await prisma.subscriptionEvent.findMany({
    // Flagged test signups are left out of every growth statistic.
    where: { excluded: false },
    select: { kind: true, occurredAt: true, revenue: true, reason: true },
    orderBy: { occurredAt: "asc" },
  });

  type Bucket = { signups: number; cancels: number; quotes: number; signupRev: number; cancelRev: number };
  const buckets = new Map<string, Bucket>();
  let totalSignups = 0, totalCancels = 0, totalQuotes = 0;
  const reasons = new Map<string, number>();
  let firstMonth = "", lastMonth = "";

  for (const e of events) {
    const key = ym(e.occurredAt);
    if (e.kind !== "QUOTE") { firstMonth = firstMonth ? (key < firstMonth ? key : firstMonth) : key; lastMonth = key > lastMonth ? key : lastMonth; }
    const b = buckets.get(key) ?? { signups: 0, cancels: 0, quotes: 0, signupRev: 0, cancelRev: 0 };
    const rev = e.revenue ?? 0;
    if (e.kind === "SIGNUP") { b.signups++; totalSignups++; b.signupRev += rev; }
    else if (e.kind === "CANCELLATION") { b.cancels++; totalCancels++; b.cancelRev += rev; if (e.reason) reasons.set(e.reason, (reasons.get(e.reason) ?? 0) + 1); }
    else if (e.kind === "QUOTE") { b.quotes++; totalQuotes++; }
    buckets.set(key, b);
  }

  const months = firstMonth ? monthRange(firstMonth, lastMonth || firstMonth) : [];
  let active = 0, peakActive = 0, mrr = 0;
  const series: GrowthPoint[] = months.map((mo) => {
    const b = buckets.get(mo) ?? { signups: 0, cancels: 0, quotes: 0, signupRev: 0, cancelRev: 0 };
    active += b.signups - b.cancels;
    mrr += b.signupRev - b.cancelRev;
    peakActive = Math.max(peakActive, active);
    return { month: mo, label: fmtMonth(mo), signups: b.signups, cancels: b.cancels, quotes: b.quotes, active, mrr };
  });

  const last = series[series.length - 1];
  const activeNow = last?.active ?? 0;
  const currentMrr = last?.mrr ?? 0;
  const thisMonthNet = last ? last.signups - last.cancels : 0;
  const best = series.reduce((a, p) => (p.signups - p.cancels > (a ? a.signups - a.cancels : -Infinity) ? p : a), null as GrowthPoint | null);
  const retention = totalSignups ? Math.round((activeNow / totalSignups) * 100) : 0;
  const topReasons = [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-3.5">
      {/* Stat cards */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(168px,1fr))" }}>
        <Stat icon={Users} label="Active customers" value={String(activeNow)} sub={`peak was ${peakActive}`} tone="iris" />
        <Stat icon={DollarSign} label="Est. monthly revenue" value={money(currentMrr)} sub="from active plans" tone="up" />
        <Stat icon={UserPlus} label="Total signups" value={String(totalSignups)} sub="unique customers, all time" tone="up" />
        <Stat icon={UserMinus} label="Total cancellations" value={String(totalCancels)} sub={`${retention}% of signups retained`} tone="down" />
        <Stat icon={TrendingUp} label="This month" value={`${thisMonthNet >= 0 ? "+" : ""}${thisMonthNet}`} sub={last ? last.label : ""} tone={thisMonthNet >= 0 ? "up" : "down"} />
        <Stat icon={FileText} label="Quote submissions" value={String(totalQuotes)} sub="web form (top of funnel)" tone="ink" />
      </div>

      {/* Growth chart */}
      <div className="dgs-card p-5">
        <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
          <h2 className="dgs-card-title">Customer growth</h2>
          <p className="text-[12px] text-muted">{best ? `Best month: ${best.label} (+${best.signups - best.cancels} net)` : ""}</p>
        </div>
        <p className="text-[12px] text-muted mb-3">Unique-customer signups vs. cancellations each month, with the running active-customer count.</p>
        <GrowthChart data={series} />
      </div>

      {/* MRR chart */}
      <div className="dgs-card p-5">
        <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
          <h2 className="dgs-card-title">Estimated recurring revenue</h2>
          <p className="text-[12px] text-muted">now ~{money(currentMrr)}/mo</p>
        </div>
        <p className="text-[12px] text-muted mb-3">Monthly recurring revenue over time, estimated from each customer&apos;s plan.</p>
        <MrrChart data={series} />
      </div>

      {/* Top cancellation reasons */}
      {topReasons.length > 0 && (
        <div className="dgs-card p-5">
          <h2 className="dgs-card-title mb-3">Why customers cancel</h2>
          <div className="space-y-2">
            {topReasons.map(([reason, count]) => {
              const pct = Math.round((count / totalCancels) * 100);
              return (
                <div key={reason} className="flex items-center gap-3">
                  <span className="text-[13px] text-bodytext w-48 flex-shrink-0 truncate">{reason}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-surface2 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#F43F5E" }} />
                  </div>
                  <span className="text-[12px] text-muted w-16 text-right flex-shrink-0">{count} · {pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
