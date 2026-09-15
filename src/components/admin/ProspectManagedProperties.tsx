"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Search, Loader2, Plus, Unlink, X, Check, Briefcase } from "lucide-react";
import { PROSPECT_TYPE_LABEL, type ProspectType } from "@/lib/commercial-prospect-types";

export interface ManagedChild {
  id: string; propertyName: string; propertyType: string; city: string; address: string | null;
  contactName: string | null; phone: string | null; email: string | null; units: number | null; notes: string | null; status: string;
}
interface Hit { id: string; propertyName: string; propertyType: string; city: string; contactName: string | null; phone: string | null; isCompany: boolean; managed: number }
const TYPE_BADGE: Record<string, string> = { HOA: "bg-violet-100 text-violet-800", APARTMENTS: "bg-amber-100 text-amber-800", SENIOR_55: "bg-sky-100 text-sky-800", OTHER: "bg-gray-100 text-gray-700" };

/**
 * The managed-properties list on a management company's info page, and the merge
 * control that adds properties to it. Merging re-parents a full prospect record
 * here — nothing is lost — and Unlink reverses it.
 */
export function ProspectManagedProperties({ companyId, companyName, isCompany, children }: { companyId: string; companyName: string; isCompany: boolean; children: ManagedChild[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [picked, setPicked] = useState<Record<string, Hit>>({});
  const [searching, setSearching] = useState(false);

  async function search(e?: React.FormEvent) {
    e?.preventDefault(); setSearching(true); setError(null);
    try {
      const r = await fetch(`/api/admin/commercial-prospects/${companyId}/merge?q=${encodeURIComponent(q)}`);
      const d = await r.json(); setHits((d.results || []).filter((h: Hit) => !picked[h.id]));
    } finally { setSearching(false); }
  }
  async function mergeSelected() {
    const ids = Object.keys(picked); if (!ids.length) return;
    setBusy("merge"); setError(null);
    try {
      const r = await fetch(`/api/admin/commercial-prospects/${companyId}/merge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceIds: ids }) });
      const d = await r.json(); if (!r.ok || !d.success) { setError(d.error || "Merge failed"); return; }
      setPicked({}); setHits([]); setQ(""); setAdding(false); router.refresh();
    } finally { setBusy(null); }
  }
  async function unmerge(child: ManagedChild) {
    if (!confirm(`Remove "${child.propertyName}" from ${companyName}? It goes back to the top-level call list with all its information intact.`)) return;
    setBusy(child.id); setError(null);
    try {
      const r = await fetch(`/api/admin/commercial-prospects/${companyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unmerge", childId: child.id }) });
      const d = await r.json(); if (!r.ok || !d.success) { setError(d.error || "Could not unmerge"); return; }
      router.refresh();
    } finally { setBusy(null); }
  }

  return (
    <div className="dgs-card p-6" id="managed">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-navy-900"><Briefcase className="w-5 h-5 inline-block mr-2 text-teal-600" />Managed properties <span className="text-gray-400 font-normal">({children.length})</span></h2>
        <button onClick={() => { setAdding((v) => !v); if (!adding) setTimeout(() => search(), 0); }} className="inline-flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700"><Plus className="w-4 h-4" /> Merge in a property</button>
      </div>
      {error && <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {!isCompany && children.length === 0 && <p className="text-sm text-gray-500 mb-3">If this is a management company, merge the properties it manages in here. It becomes a company automatically, and each property keeps all of its own information.</p>}

      {adding && (
        <div className="mb-4 p-4 rounded-lg border border-gray-200 bg-gray-50">
          <form onSubmit={search} className="flex gap-2">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search properties by name, city, contact…" className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" /></div>
            <button type="submit" disabled={searching} className="px-3 py-2 rounded-lg bg-navy-600 text-white text-sm font-semibold disabled:opacity-50">{searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}</button>
          </form>
          {Object.values(picked).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {Object.values(picked).map((h) => (
                <span key={h.id} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-teal-100 text-teal-800">{h.propertyName}<button onClick={() => setPicked((p) => { const n = { ...p }; delete n[h.id]; return n; })}><X className="w-3 h-3" /></button></span>
              ))}
              <button onClick={mergeSelected} disabled={busy === "merge"} className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">{busy === "merge" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Merge {Object.keys(picked).length}</button>
            </div>
          )}
          <ul className="mt-3 max-h-64 overflow-auto divide-y divide-gray-100 border border-gray-100 rounded-lg bg-white">
            {hits.length === 0 ? <li className="px-3 py-3 text-sm text-gray-400">{searching ? "Searching…" : "No matching properties."}</li> : hits.map((h) => (
              <li key={h.id}>
                <button onClick={() => { setPicked((p) => ({ ...p, [h.id]: h })); setHits((x) => x.filter((y) => y.id !== h.id)); }} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50">
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${TYPE_BADGE[h.propertyType] || TYPE_BADGE.OTHER}`}>{PROSPECT_TYPE_LABEL[h.propertyType as ProspectType] || h.propertyType}</span>
                  <span className="min-w-0 flex-1"><span className="text-sm font-medium text-navy-900">{h.propertyName}</span>{h.isCompany && h.managed > 0 && <span className="ml-2 text-[11px] text-amber-700">manages {h.managed}</span>}<span className="block text-xs text-gray-500 truncate">{[h.contactName, h.city, h.phone].filter(Boolean).join(" · ")}</span></span>
                  <Plus className="w-4 h-4 text-teal-600 flex-shrink-0" />
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-gray-400 mt-2">Merging moves a property under this company with everything it has. If a chosen property manages others, those move up here too.</p>
        </div>
      )}

      {children.length === 0 ? (
        !adding && <p className="text-sm text-gray-500">No managed properties yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
          {children.map((c) => (
            <li key={c.id} className="p-3 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/leads/commercial/call-list/${c.id}`} className="font-semibold text-navy-900 hover:text-teal-700 hover:underline">{c.propertyName}</Link>
                  <p className="mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${TYPE_BADGE[c.propertyType] || TYPE_BADGE.OTHER}`}>{PROSPECT_TYPE_LABEL[c.propertyType as ProspectType] || c.propertyType}</span>
                    {c.units ? <span className="text-xs text-gray-500">{c.units} units</span> : null}
                    {c.status === "CONVERTED" && <span className="text-xs text-green-700 font-medium">Converted</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{[c.address, [c.city].filter(Boolean).join(""), c.contactName, c.phone, c.email].filter(Boolean).join(" · ")}</p>
                  {c.notes ? <p className="text-xs text-gray-400 mt-1 whitespace-pre-line line-clamp-2 max-w-xl">{c.notes}</p> : null}
                </div>
                <button onClick={() => unmerge(c)} disabled={busy === c.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 flex-shrink-0" title="Move back to the top-level call list">{busy === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />} Unlink</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
