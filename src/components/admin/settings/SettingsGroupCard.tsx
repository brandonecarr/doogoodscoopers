"use client";

import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";

export type FieldDef = { key: string; label: string; type: "boolean" | "text" | "number" | "textarea" | "url"; hint?: string; placeholder?: string; min?: number; max?: number; readonly?: boolean };
export interface GroupDef { id: string; title: string; description: string; prefix: string; fields: FieldDef[]; manageHref?: string; manageLabel?: string }

/** One card per settings group, reading/writing AppSetting keys via /api/admin/app-settings. Saves on change. */
export function SettingsGroupCard({ group }: { group: GroupDef }) {
  const [vals, setVals] = useState<Record<string, string>>({}); const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); const [saved, setSaved] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { fetch(`/api/admin/app-settings?prefix=${encodeURIComponent(group.prefix)}`).then((r) => r.json()).then((d) => setVals(d.settings || {})).catch(() => {}).finally(() => setLoading(false)); }, [group.prefix]);
  async function save(key: string, value: string) {
    setVals((v) => ({ ...v, [key]: value })); setSaving(key); setSaved(null); setError(null);
    try { const r = await fetch("/api/admin/app-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: { [key]: value } }) }); if (!r.ok) setError("Could not save"); else { setSaved(key); setTimeout(() => setSaved(null), 1500); } }
    finally { setSaving(null); }
  }
  const input = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50";
  return (
    <div className="dgs-card p-6" id={group.id}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div><h2 className="text-lg font-semibold text-navy-900">{group.title}</h2><p className="text-sm text-gray-500">{group.description}</p></div>
        {group.manageHref && <a href={group.manageHref} className="text-sm text-teal-700 hover:underline whitespace-nowrap">{group.manageLabel || "Open"} →</a>}
      </div>
      {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
      {loading ? <p className="text-sm text-gray-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p> : (
        <div className="space-y-4">
          {group.fields.map((f) => {
            const v = vals[f.key] ?? ""; const state = saving === f.key ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" /> : saved === f.key ? <Check className="w-3.5 h-3.5 text-green-600" /> : null;
            if (f.type === "boolean") return (
              <div key={f.key} className="flex items-start justify-between gap-4">
                <div><p className="text-sm font-medium text-navy-900">{f.label}</p>{f.hint && <p className="text-xs text-gray-500">{f.hint}</p>}</div>
                <div className="flex items-center gap-2">{state}<button role="switch" aria-checked={v === "true"} disabled={!!f.readonly} onClick={() => save(f.key, v === "true" ? "false" : "true")} className="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-50" style={{ background: v === "true" ? "#16A34A" : "#D1D5DB" }}><span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${v === "true" ? "translate-x-[22px]" : "translate-x-0.5"}`} /></button></div>
              </div>
            );
            return (
              <div key={f.key}>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">{f.label} {state}</label>
                {f.type === "textarea"
                  ? <textarea rows={3} defaultValue={v} disabled={f.readonly} placeholder={f.placeholder} onBlur={(e) => e.target.value !== v && save(f.key, e.target.value)} className={`${input} resize-none`} />
                  : <input type={f.type === "number" ? "number" : f.type === "url" ? "url" : "text"} min={f.min} max={f.max} defaultValue={v} disabled={f.readonly} placeholder={f.placeholder} onBlur={(e) => e.target.value !== v && save(f.key, e.target.value)} className={input} />}
                {f.hint && <p className="text-xs text-gray-500 mt-1">{f.hint}</p>}
              </div>
            );
          })}
          <p className="text-[11px] text-gray-400">Text fields save when you click away.</p>
        </div>
      )}
    </div>
  );
}
