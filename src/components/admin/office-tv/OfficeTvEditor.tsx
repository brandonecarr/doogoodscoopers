"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Target, LayoutGrid, GitBranch, KeyRound, AlertTriangle, Check } from "lucide-react";
import { validateConfig, type TvBoardConfig } from "@/lib/tv-config";
import { OfficeTvCard } from "@/components/admin/settings/OfficeTvCard";
import { GoalTab } from "./GoalTab";
import { BoardsTab } from "./BoardsTab";
import { PipelineTab } from "./PipelineTab";

export interface GoalContext { activeCustomers: number; weeklyPace: number }
type Tab = "goal" | "boards" | "pipeline" | "connection";

const TABS: { id: Tab; label: string; icon: typeof Target }[] = [
  { id: "goal", label: "Goal", icon: Target },
  { id: "boards", label: "Boards", icon: LayoutGrid },
  { id: "pipeline", label: "Pipeline", icon: GitBranch },
  { id: "connection", label: "Connection", icon: KeyRound },
];

/** Edits what the office TV shows. Saves to TvConfig; the TV picks changes up within a minute. */
export function OfficeTvEditor() {
  const [tab, setTab] = useState<Tab>("goal");
  const [config, setConfig] = useState<TvBoardConfig | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [version, setVersion] = useState(0);
  const [isDefault, setIsDefault] = useState(false);
  const [context, setContext] = useState<GoalContext>({ activeCustomers: 0, weeklyPace: 0 });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  async function load() {
    setError(null);
    const r = await fetch("/api/admin/tv-config");
    const d = await r.json();
    if (!r.ok) { setError(d.error || "Couldn't load the TV settings"); return; }
    setConfig(d.config); setSaved(JSON.stringify(d.config)); setVersion(d.version); setIsDefault(d.isDefault); setContext(d.context);
  }
  useEffect(() => { void load(); }, []);

  const dirty = config !== null && JSON.stringify(config) !== saved;
  const problems = useMemo(() => (config ? validateConfig(config) : []), [config]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save() {
    if (!config || problems.length) return;
    setSaving(true); setError(null);
    try {
      const r = await fetch("/api/admin/tv-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config, version }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Couldn't save"); return; }
      setConfig(d.config); setSaved(JSON.stringify(d.config)); setVersion(d.version); setIsDefault(false);
      setJustSaved(true); setTimeout(() => setJustSaved(false), 2500);
    } finally { setSaving(false); }
  }

  if (!config) {
    return error
      ? <div className="dgs-card p-6 text-sm text-red-700">{error}</div>
      : <p className="text-sm text-gray-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>;
  }

  const update = (next: TvBoardConfig) => setConfig(next);

  return (
    <div className="space-y-3.5">
      {/* Tabs + save bar */}
      <div className="dgs-card p-3 flex flex-wrap items-center justify-between gap-3 sticky top-2 z-20">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === t.id ? "bg-navy-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>
        {tab !== "connection" && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {dirty ? "Unsaved changes" : isDefault ? "Design default · not saved yet" : `Saved · version ${version}`}
            </span>
            {dirty && <button onClick={() => setConfig(JSON.parse(saved))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50">Discard</button>}
            <button onClick={save} disabled={saving || !dirty || problems.length > 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-40">
              {justSaved ? <Check className="w-4 h-4" /> : saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {justSaved ? "Saved" : "Save to TV"}
            </button>
          </div>
        )}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start justify-between gap-3"><span>{error}</span>{error.includes("Reload") && <button onClick={load} className="text-red-800 font-semibold underline whitespace-nowrap">Reload</button>}</div>}
      {problems.length > 0 && tab !== "connection" && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
          <p className="font-semibold inline-flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Fix before saving</p>
          <ul className="mt-1 list-disc pl-5 space-y-0.5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}

      {tab === "goal" && <GoalTab config={config} onChange={update} context={context} />}
      {tab === "boards" && <BoardsTab config={config} onChange={update} />}
      {tab === "pipeline" && <PipelineTab config={config} onChange={update} />}
      {tab === "connection" && <OfficeTvCard />}

      {tab !== "connection" && <p className="text-[11px] text-gray-400">The TV checks for changes every minute. Rotation speed is set on each TV (Settings on the TV).</p>}
    </div>
  );
}
