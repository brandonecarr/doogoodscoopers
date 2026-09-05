"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2, Save, Database } from "lucide-react";

/** Every stored key/value (non-secret). For anything the cards above don't cover. */
export function AllSettingsCard() {
  const [rows, setRows] = useState<[string, string][]>([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({}); const [open, setOpen] = useState(false);
  const load = () => fetch("/api/admin/app-settings").then((r) => r.json()).then((d) => setRows(Object.entries(d.settings || {}).sort(([a], [b]) => a.localeCompare(b)) as [string, string][])).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);
  async function save(k: string) { setBusy(k); try { await fetch("/api/admin/app-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: { [k]: draft[k] } }) }); await load(); } finally { setBusy(null); } }
  async function del(k: string) { if (!confirm(`Delete setting "${k}"? The feature that uses it falls back to its default.`)) return; setBusy(k); try { await fetch("/api/admin/app-settings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: k }) }); await load(); } finally { setBusy(null); } }
  return (
    <div className="dgs-card p-6" id="advanced">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"><Database className="w-5 h-5 text-gray-600" /></div><div><h2 className="text-lg font-semibold text-navy-900">Advanced: all stored settings</h2><p className="text-sm text-gray-500">{loading ? "…" : `${rows.length} keys`}. Tokens and secrets are hidden and managed on their own pages.</p></div></div>
        <span className="text-sm text-teal-700">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (loading ? <p className="text-sm text-gray-400 mt-4 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p> : (
        <div className="mt-4 overflow-x-auto"><table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100"><tr>{["Key", "Value", ""].map((h, i) => <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td className="px-3 py-2 font-mono text-xs text-navy-900 whitespace-nowrap align-top">{k}</td>
                <td className="px-3 py-2"><textarea rows={v.length > 80 ? 3 : 1} defaultValue={v} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} className="w-full px-2 py-1 text-xs font-mono border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y" /></td>
                <td className="px-3 py-2 align-top"><div className="flex gap-1">
                  <button onClick={() => save(k)} disabled={busy === k || draft[k] === undefined || draft[k] === v} className="p-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 disabled:opacity-40" title="Save"><Save className="w-3.5 h-3.5" /></button>
                  <button onClick={() => del(k)} disabled={busy === k} className="p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                </div></td>
              </tr>
            ))}
          </tbody></table></div>
      ))}
    </div>
  );
}
