"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Radar, Loader2, Play, Copy, Check, Flame, TrendingUp, Sparkle, Ban, ChevronDown,
  Building2, Plus, X, Trash2, Search, AlertTriangle, ClipboardList, FileDown, Upload, BarChart3,
} from "lucide-react";
import { PageHero, heroBtnPrimary, heroPrimaryStyle, heroBtnSecondary } from "@/components/admin/PageHero";
import { formatDate, formatDateTime } from "@/lib/datetime";

export interface RadarItem {
  id: string; term: string; bucket: string; intent: string | null; matchType: string | null;
  rationale: string | null; adGroup: string | null; competitor: string | null;
  monthlySearches: number | null; volumeLabel: string | null; competition: string | null; topBidLow: number | null; topBidHigh: number | null;
  source: string; isNegative: boolean; status: string;
}
export interface RadarReport {
  id: string; weekOf: string; generatedAt: string; model: string | null; summary: string; usedGoogleAds: boolean; items: RadarItem[];
}
export interface RadarCompetitor { id: string; name: string; website: string | null; active: boolean }
export interface PlannerStats { count: number; lastUploadedAt: string | null; lastFile: string | null }

/** "1,300" or a Keyword Planner range like "1K–10K". */
const volumeText = (it: { volumeLabel: string | null; monthlySearches: number | null }) =>
  it.volumeLabel ?? (it.monthlySearches != null ? it.monthlySearches.toLocaleString() : null);

const BUCKET_META: Record<string, { label: string; icon: typeof Flame; tint: string; dot: string }> = {
  HOT:      { label: "Hot — bid now",   icon: Flame,      tint: "text-red-700",    dot: "bg-red-500" },
  TRENDING: { label: "Trending",        icon: TrendingUp, tint: "text-amber-700",  dot: "bg-amber-500" },
  NEW:      { label: "New opportunities", icon: Sparkle,  tint: "text-teal-700",   dot: "bg-teal-500" },
};
const MATCH_BADGE: Record<string, string> = { exact: "bg-indigo-100 text-indigo-800", phrase: "bg-blue-100 text-blue-800", broad: "bg-gray-100 text-gray-700" };
const COMP_BADGE: Record<string, string> = { LOW: "bg-green-100 text-green-800", MEDIUM: "bg-amber-100 text-amber-800", HIGH: "bg-red-100 text-red-800" };

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }).catch(() => {}); }}
      className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
      title="Copy keyword"
    >
      {done ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export function KeywordRadar({ report, history, competitors, plannerStats, anthropicConfigured }: {
  report: RadarReport | null;
  history: string[];
  competitors: RadarCompetitor[];
  plannerStats: PlannerStats;
  anthropicConfigured: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const [items, setItems] = useState<RadarItem[]>(report?.items ?? []);
  const [comps, setComps] = useState<RadarCompetitor[]>(competitors);
  const [newComp, setNewComp] = useState({ name: "", website: "" });

  const run = async () => {
    setRunning(true); setError(null);
    try {
      const res = await fetch("/api/admin/keyword-radar/generate", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Generation failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setRunning(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status } : it)));
    await fetch(`/api/admin/keyword-radar/items/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    }).catch(() => {});
  };

  const addComp = async () => {
    const name = newComp.name.trim();
    if (!name) return;
    const res = await fetch("/api/admin/keyword-radar/competitors", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newComp),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { setComps((p) => [...p, { id: d.id, name, website: newComp.website.trim() || null, active: true }]); setNewComp({ name: "", website: "" }); }
  };
  const toggleComp = async (c: RadarCompetitor) => {
    setComps((p) => p.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)));
    await fetch(`/api/admin/keyword-radar/competitors/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !c.active }) }).catch(() => {});
  };
  const removeComp = async (id: string) => {
    setComps((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/admin/keyword-radar/competitors/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const visible = items.filter((it) => showDismissed || it.status !== "DISMISSED");
  const negatives = visible.filter((it) => it.isNegative);
  const positives = visible.filter((it) => !it.isNegative);
  const byBucket = (b: string) => positives.filter((it) => it.bucket === b);

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <PageHero
        title="Keyword Radar"
        subtitle="Weekly AI research on new, trending & hot Google keywords in your industry — and what competitors are winning on."
        icon={<div className="w-11 h-11 rounded-[13px] flex items-center justify-center" style={{ background: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}><Radar className="w-[22px] h-[22px] text-white" /></div>}
        actions={<>
          <button onClick={() => setShowConfig((v) => !v)} className={heroBtnSecondary}><Building2 className="w-4 h-4" /><span className="hidden sm:inline">Competitors</span></button>
          <button onClick={run} disabled={running || !anthropicConfigured} className={heroBtnPrimary} style={heroPrimaryStyle}>
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span className="hidden sm:inline">{running ? "Researching…" : "Run now"}</span>
          </button>
        </>}
      />

      {error && <div className="dgs-card p-3 border border-red-200 bg-red-50 text-red-700 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>}

      {!anthropicConfigured && (
        <div className="dgs-card p-3 border border-amber-200 bg-amber-50 text-amber-800 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> The keyword agent needs <code className="mx-1 px-1 bg-amber-100 rounded">ANTHROPIC_API_KEY</code> set in Vercel to run.
        </div>
      )}

      <PlannerCard
        stats={plannerStats}
        reportId={report?.id ?? null}
        terms={positives.filter((it) => it.status !== "DISMISSED").map((it) => it.term)}
      />

      {/* Competitors config */}
      {showConfig && (
        <div className="dgs-card p-4">
          <h3 className="text-[14px] font-bold text-ink mb-3 flex items-center gap-2"><Building2 className="w-4 h-4 text-iris-link" /> Competitors the agent studies</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {comps.map((c) => (
              <div key={c.id} className={`flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-[10px] border text-[13px] ${c.active ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"}`}>
                <button onClick={() => toggleComp(c)} title={c.active ? "Tracking — click to pause" : "Paused — click to track"} className={`w-2.5 h-2.5 rounded-full ${c.active ? "bg-green-500" : "bg-gray-300"}`} />
                <span className="font-semibold text-ink">{c.name}</span>
                {c.website && <span className="text-gray-400 text-[11px]">{c.website}</span>}
                <button onClick={() => removeComp(c.id)} className="p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            {!comps.length && <p className="text-sm text-gray-400">No competitors yet — add a few below.</p>}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={newComp.name} onChange={(e) => setNewComp({ ...newComp, name: e.target.value })} placeholder="Competitor name" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
            <input value={newComp.website} onChange={(e) => setNewComp({ ...newComp, website: e.target.value })} placeholder="Website (optional)" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
            <button onClick={addComp} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold text-white" style={heroPrimaryStyle}><Plus className="w-4 h-4" />Add</button>
          </div>
        </div>
      )}

      {/* History week selector */}
      {history.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-semibold text-gray-400">Week of:</span>
          {history.map((w) => {
            const active = report && report.weekOf.slice(0, 10) === w.slice(0, 10);
            return (
              <Link key={w} href={`/admin/keyword-radar?week=${w.slice(0, 10)}`} className={`px-2.5 py-1 rounded-[9px] text-[12px] font-semibold transition-colors ${active ? "bg-ink text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {formatDate(w, { month: "short", day: "numeric" })}
              </Link>
            );
          })}
        </div>
      )}

      {!report ? (
        <div className="dgs-card p-12 text-center text-gray-400">
          <Radar className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p className="font-semibold text-gray-500 text-lg">No keyword report yet</p>
          <p className="text-sm mt-1 max-w-md mx-auto">Click <b>Run now</b> to have the agent research this week&apos;s new, trending, and hot keywords. It also runs automatically every Monday.</p>
          <button onClick={run} disabled={running || !anthropicConfigured} className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-white font-bold disabled:opacity-50" style={heroPrimaryStyle}>
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}{running ? "Researching…" : "Run the first report"}
          </button>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="dgs-card p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
              <h2 className="text-[16px] font-extrabold text-ink">Week of {formatDate(report.weekOf, { month: "long", day: "numeric", year: "numeric" })}</h2>
              <div className="flex items-center gap-2 text-[11.5px] text-gray-400">
                <span>Generated {formatDateTime(report.generatedAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                {items.some((it) => it.source === "google_ads") && <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-semibold">+ Google Ads data</span>}
                {items.some((it) => volumeText(it) != null) && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">+ search volume</span>}
                <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={showDismissed} onChange={(e) => setShowDismissed(e.target.checked)} className="accent-violet-600" /> show dismissed</label>
              </div>
            </div>
            <p className="text-[14px] text-bodytext leading-relaxed">{report.summary}</p>
          </div>

          {/* Best terms — copy-ready list for the Ads builder */}
          <BestTermsList positives={positives} negatives={negatives} weekOf={report.weekOf} />

          {/* Buckets */}
          {(["HOT", "TRENDING", "NEW"] as const).map((bucket) => {
            const list = byBucket(bucket);
            if (!list.length) return null;
            const meta = BUCKET_META[bucket];
            const Icon = meta.icon;
            return (
              <div key={bucket} className="dgs-card p-4 sm:p-5">
                <h3 className={`text-[15px] font-extrabold mb-3 flex items-center gap-2 ${meta.tint}`}>
                  <Icon className="w-[18px] h-[18px]" /> {meta.label} <span className="text-gray-400 font-semibold">· {list.length}</span>
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                  {list.map((it) => <ItemCard key={it.id} it={it} onStatus={setStatus} />)}
                </div>
              </div>
            );
          })}

          {/* Negatives */}
          {negatives.length > 0 && (
            <div className="dgs-card p-4 sm:p-5">
              <h3 className="text-[15px] font-extrabold mb-3 flex items-center gap-2 text-gray-600"><Ban className="w-[18px] h-[18px]" /> Suggested negative keywords <span className="text-gray-400 font-semibold">· {negatives.length}</span></h3>
              <div className="flex flex-wrap gap-2">
                {negatives.map((it) => (
                  <span key={it.id} className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-[10px] bg-gray-50 border border-gray-200 text-[13px] text-gray-700" title={it.rationale || ""}>
                    <Ban className="w-3.5 h-3.5 text-gray-400" />{it.term}<CopyBtn text={it.term} />
                  </span>
                ))}
              </div>
              <p className="text-[11.5px] text-gray-400 mt-2">Add these as negative keywords in your campaigns to stop wasting spend on the wrong searches.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ItemCard({ it, onStatus }: { it: RadarItem; onStatus: (id: string, status: string) => void }) {
  const implemented = it.status === "IMPLEMENTED";
  const dismissed = it.status === "DISMISSED";
  return (
    <div className={`rounded-[12px] border p-3 transition-colors ${implemented ? "border-green-200 bg-green-50/50" : dismissed ? "border-gray-100 bg-gray-50 opacity-60" : "border-gray-200 bg-white hover:border-gray-300"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="font-semibold text-[13.5px] text-ink truncate">{it.term}</span>
            <CopyBtn text={it.term} />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            {it.matchType && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${MATCH_BADGE[it.matchType] || "bg-gray-100 text-gray-700"}`}>{it.matchType}</span>}
            {it.intent && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-100 text-violet-800">{it.intent}</span>}
            {it.competitor && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">{it.competitor}</span>}
            {it.source === "google_ads" && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-800">Google Ads</span>}
            {it.source === "keyword_planner" && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">Keyword Planner</span>}
          </div>
        </div>
      </div>

      {(volumeText(it) != null || it.competition || it.topBidLow != null) && (
        <div className="flex items-center gap-3 mt-2 text-[11.5px] text-gray-600">
          {volumeText(it) != null && <span><b className="text-ink">{volumeText(it)}</b>/mo searches</span>}
          {it.competition && <span className={`px-1.5 py-0.5 rounded font-semibold ${COMP_BADGE[it.competition] || "bg-gray-100 text-gray-700"}`}>{it.competition.toLowerCase()} comp</span>}
          {it.topBidLow != null && <span>bid ${it.topBidLow.toFixed(2)}{it.topBidHigh != null ? `–$${it.topBidHigh.toFixed(2)}` : ""}</span>}
        </div>
      )}

      {it.adGroup && <p className="text-[11px] text-gray-400 mt-1.5">Ad group: <span className="text-gray-600 font-medium">{it.adGroup}</span></p>}
      {it.rationale && <p className="text-[12px] text-gray-500 mt-1.5 leading-snug">{it.rationale}</p>}

      <div className="flex items-center gap-1.5 mt-2.5">
        <button onClick={() => onStatus(it.id, implemented ? "NEW" : "IMPLEMENTED")} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold transition-colors ${implemented ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700"}`}>
          <Check className="w-3.5 h-3.5" />{implemented ? "Added" : "Mark added"}
        </button>
        <button onClick={() => onStatus(it.id, dismissed ? "NEW" : "DISMISSED")} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
          {dismissed ? <><Plus className="w-3.5 h-3.5" />Restore</> : <><Trash2 className="w-3.5 h-3.5" />Dismiss</>}
        </button>
      </div>
    </div>
  );
}

// ─── Best terms: the copy-ready deliverable ─────────────────────────────────────
const BUCKET_RANK: Record<string, number> = { HOT: 0, TRENDING: 1, NEW: 2 };
/** Google Ads match-type syntax: exact [term], phrase "term", broad term. */
function adFormat(term: string, matchType: string | null): string {
  if (matchType === "exact") return `[${term}]`;
  if (matchType === "phrase") return `"${term}"`;
  return term;
}
function sortedPositives(items: RadarItem[]): RadarItem[] {
  return [...items].sort(
    (a, b) => (BUCKET_RANK[a.bucket] ?? 3) - (BUCKET_RANK[b.bucket] ?? 3) || (b.monthlySearches ?? 0) - (a.monthlySearches ?? 0),
  );
}
function groupByAdGroup(items: RadarItem[]): [string, RadarItem[]][] {
  const groups = new Map<string, RadarItem[]>();
  for (const it of items) {
    const g = it.adGroup?.trim() || "General";
    const arr = groups.get(g);
    if (arr) arr.push(it); else groups.set(g, [it]);
  }
  return [...groups.entries()];
}
function buildTermsText(positives: RadarItem[], negatives: RadarItem[], weekLabel: string): string {
  const lines: string[] = [`Best Google Ads keywords — week of ${weekLabel}`, ""];
  for (const [group, its] of groupByAdGroup(sortedPositives(positives))) {
    lines.push(`# ${group}`);
    for (const it of its) lines.push(adFormat(it.term, it.matchType));
    lines.push("");
  }
  if (negatives.length) {
    lines.push("# Negative keywords");
    lines.push(negatives.map((n) => n.term).join(", "));
  }
  return lines.join("\n").trim();
}
function buildCsv(positives: RadarItem[]): string {
  const rows: (string | number)[][] = [["keyword", "match_type", "ad_group", "bucket", "monthly_searches", "competition"]];
  for (const it of sortedPositives(positives)) {
    rows.push([it.term, it.matchType || "broad", it.adGroup || "General", it.bucket, volumeText(it) ?? "", it.competition || ""]);
  }
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function CopyTextButton({ text, label, icon: Icon, primary }: { text: string; label: string; icon: typeof Copy; primary?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1400); }).catch(() => {}); }}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12.5px] font-bold transition-colors ${primary ? "text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
      style={primary ? heroPrimaryStyle : undefined}
    >
      {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}{done ? "Copied!" : label}
    </button>
  );
}

function BestTermsList({ positives, negatives, weekOf }: { positives: RadarItem[]; negatives: RadarItem[]; weekOf: string }) {
  if (!positives.length && !negatives.length) return null;
  const weekLabel = formatDate(weekOf, { month: "long", day: "numeric", year: "numeric" });
  const groups = groupByAdGroup(sortedPositives(positives));
  return (
    <div className="dgs-card p-4 sm:p-5 border border-iris-link/20">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <h3 className="text-[15px] font-extrabold text-ink flex items-center gap-2"><ClipboardList className="w-[18px] h-[18px] text-iris-link" /> Best terms to add this week <span className="text-gray-400 font-semibold">· {positives.length}</span></h3>
        <div className="flex items-center gap-2">
          <CopyTextButton text={buildTermsText(positives, negatives, weekLabel)} label="Copy list" icon={Copy} primary />
          <CopyTextButton text={buildCsv(positives)} label="CSV" icon={FileDown} />
        </div>
      </div>
      <p className="text-[11.5px] text-gray-400 mb-3">Ready to paste into Google Ads or hand to your Ads builder — grouped by ad group, in match-type syntax (<span className="font-mono">[exact]</span>, <span className="font-mono">&quot;phrase&quot;</span>, broad).</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4">
        {groups.map(([group, its]) => (
          <div key={group}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">{group}</span>
              <span className="text-[10px] text-gray-400">· {its.length}</span>
              <CopyTextButton text={its.map((it) => adFormat(it.term, it.matchType)).join("\n")} label="" icon={Copy} />
            </div>
            <ul className="space-y-0.5">
              {its.map((it) => {
                const meta = BUCKET_META[it.bucket];
                return (
                  <li key={it.id} className="flex items-center gap-2 group">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta?.dot || "bg-gray-400"}`} />
                    <code className="text-[13px] text-ink font-mono">{adFormat(it.term, it.matchType)}</code>
                    {volumeText(it) != null && <span className="text-[10.5px] text-gray-400">{volumeText(it)}/mo</span>}
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity"><CopyBtn text={adFormat(it.term, it.matchType)} /></span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {negatives.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1"><Ban className="w-3.5 h-3.5" /> Negatives</span>
            <CopyTextButton text={negatives.map((n) => n.term).join("\n")} label="Copy negatives" icon={Copy} />
          </div>
          <p className="text-[13px] text-gray-600 font-mono leading-relaxed">{negatives.map((n) => n.term).join(", ")}</p>
        </div>
      )}
    </div>
  );
}

// ─── Keyword Planner uploads: real search volume without API access ────────────
const FLASH_KEY = "keyword-radar-upload-msg";

function PlannerCard({ stats, reportId, terms }: { stats: PlannerStats; reportId: string | null; terms: string[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [showHow, setShowHow] = useState(stats.count === 0);
  // The page remounts after an upload (fresh numbers), so the result is handed across via sessionStorage.
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(() => {
    try {
      const text = sessionStorage.getItem(FLASH_KEY);
      if (text) { sessionStorage.removeItem(FLASH_KEY); return { ok: true, text }; }
    } catch {}
    return null;
  });

  const upload = async (file: File) => {
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (reportId) fd.append("reportId", reportId);
      const res = await fetch("/api/admin/keyword-radar/planner-upload", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Upload failed");
      const text = `Imported ${Number(d.imported).toLocaleString()} keywords from ${file.name}` +
        (reportId ? ` — filled real numbers on ${d.matched} of this week's keywords.` : ".") +
        (d.ranges ? " Google shows ranges (e.g. 1K–10K) until an account spends more; that's normal." : "");
      try { sessionStorage.setItem(FLASH_KEY, text); } catch {}
      setMsg({ ok: true, text });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="dgs-card p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-[10px] bg-blue-50 flex items-center justify-center flex-shrink-0"><BarChart3 className="w-[18px] h-[18px] text-blue-600" /></div>
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-ink">Search volume · Google Keyword Planner</h3>
            <p className="text-[12.5px] text-gray-500">
              {stats.count
                ? <>{stats.count.toLocaleString()} keywords on file · last upload {formatDate(stats.lastUploadedAt!, { month: "short", day: "numeric", year: "numeric" })}{stats.lastFile ? <span className="text-gray-400"> ({stats.lastFile})</span> : null}</>
                : "No data yet. Export from Keyword Planner and upload the CSV to add real monthly searches, competition, and bids."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {terms.length > 0 && <CopyTextButton text={terms.join("\n")} label="Copy keywords for Planner" icon={Copy} />}
          <input ref={inputRef} type="file" accept=".csv,text/csv,text/plain,text/tab-separated-values" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          <button onClick={() => inputRef.current?.click()} disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12.5px] font-bold text-white disabled:opacity-60" style={heroPrimaryStyle}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}{busy ? "Importing…" : "Upload CSV"}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`mt-3 px-3 py-2 rounded-lg text-[12.5px] flex items-start gap-2 ${msg.ok ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg.ok ? <Check className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}{msg.text}
        </div>
      )}

      <button onClick={() => setShowHow((v) => !v)} className="mt-2.5 text-[12px] font-semibold text-blue-700 inline-flex items-center gap-0.5">
        How to export from Keyword Planner <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showHow ? "rotate-180" : ""}`} />
      </button>
      {showHow && (
        <ol className="mt-2 ml-5 list-decimal space-y-1 text-[12.5px] text-gray-600">
          <li>Click <b>Copy keywords for Planner</b> above to copy this week&apos;s keywords.</li>
          <li>In Google Ads, open <b>Tools → Planning → Keyword Planner</b> and choose <b>Get search volume and forecasts</b>.</li>
          <li>Paste the keywords and click <b>Get started</b>.</li>
          <li>Set <b>Locations</b> to your service area (e.g. San Bernardino and Riverside counties) so the numbers are local, not national.</li>
          <li>Open the <b>Historical metrics</b> tab, click the download icon, and choose <b>.csv</b>. (A &ldquo;Keyword ideas&rdquo; download from <b>Discover new keywords</b> works too.)</li>
          <li>Click <b>Upload CSV</b> here. Numbers fill in on this week&apos;s report now and on every future Monday report automatically.</li>
        </ol>
      )}
    </div>
  );
}
