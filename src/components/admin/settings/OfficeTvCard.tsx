"use client";

import { useEffect, useState } from "react";
import { Tv, KeyRound, Trash2, Loader2, Copy, Check } from "lucide-react";

interface K { id: string; label: string; keyPreview: string; createdAt: string; lastUsedAt: string | null }
const input = "w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent";
const when = (d: string | null) => (d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Never");

/** Connector keys for the office Apple TV ("Growth Board"). */
export function OfficeTvCard() {
  const [keys, setKeys] = useState<K[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("Office TV");
  const [reveal, setReveal] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = () => fetch("/api/admin/tv-keys").then((r) => r.json()).then((d) => setKeys(d.keys || [])).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy("create"); setError(null);
    try {
      const r = await fetch("/api/admin/tv-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }) });
      const d = await r.json(); if (!r.ok) { setError(d.error || "Could not create key"); return; }
      setReveal(d.raw); await load();
    } finally { setBusy(null); }
  }
  async function revoke(k: K) {
    if (!confirm(`Revoke "${k.label}" (…${k.keyPreview})? That TV stops getting admin data on its next refresh.`)) return;
    setBusy(k.id); setError(null);
    try {
      const r = await fetch("/api/admin/tv-keys", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: k.id }) });
      if (!r.ok) { setError("Could not revoke"); return; }
      await load();
    } finally { setBusy(null); }
  }
  const copy = async () => { if (!reveal) return; await navigator.clipboard.writeText(reveal).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className="dgs-card p-6" id="office-tv">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><Tv className="w-5 h-5 text-blue-600" /></div>
        <div><h2 className="text-lg font-semibold text-navy-900">Office TV</h2><p className="text-sm text-gray-500">Keys for the Apple TV Growth Board. On the TV: Settings → DooGoodScoopers Admin → paste the key.</p></div>
      </div>
      {error && <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {reveal && (
        <div className="p-4 mb-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-semibold text-green-800">Copy this key now. It isn&apos;t shown again.</p>
          <p className="mt-1 font-mono text-sm text-navy-900 break-all">{reveal}</p>
          <div className="flex gap-2 mt-2"><button onClick={copy} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-green-300 text-green-800">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copied" : "Copy key"}</button><button onClick={() => setReveal(null)} className="px-2.5 py-1 text-xs text-gray-600">Dismiss</button></div>
        </div>
      )}
      <form onSubmit={create} className="flex flex-col sm:flex-row gap-2 mb-4">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Which TV? e.g. Office TV" className={input} maxLength={60} />
        <button type="submit" disabled={busy === "create"} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 whitespace-nowrap"><KeyRound className="w-4 h-4" /> {busy === "create" ? "Creating…" : "Create key"}</button>
      </form>
      {loading ? <p className="text-sm text-gray-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p> : keys.length === 0 ? (
        <p className="text-sm text-gray-500">No keys yet.</p>
      ) : (
        <div className="overflow-x-auto"><table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100"><tr>{["TV", "Created", "Last used", ""].map((h) => <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {keys.map((k) => (
              <tr key={k.id}>
                <td className="px-4 py-3"><p className="font-medium text-navy-900">{k.label}</p><p className="text-xs text-gray-400 font-mono">…{k.keyPreview}</p></td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{when(k.createdAt)}</td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{when(k.lastUsedAt)}</td>
                <td className="px-4 py-3 text-right"><button onClick={() => revoke(k)} disabled={!!busy} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" /> Revoke</button></td>
              </tr>
            ))}
          </tbody></table></div>
      )}
    </div>
  );
}
