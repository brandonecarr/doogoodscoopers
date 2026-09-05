"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Footprints, UserPlus, Send, Trash2, Loader2, Power } from "lucide-react";

interface C { id: string; email: string; name: string; status: "active" | "invited" | "inactive"; lastLoginAt: string | null; createdAt: string }
const input = "w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent";
const BADGE: Record<string, string> = { active: "bg-green-100 text-green-800", invited: "bg-amber-100 text-amber-800", inactive: "bg-gray-100 text-gray-700" };

/** Field canvasser logins (the /app/canvasser tool). Invites go out by email; no passwords are set here. */
export function CanvasserUsersCard() {
  const [rows, setRows] = useState<C[]>([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "" }); const [showAdd, setShowAdd] = useState(false);
  const load = () => fetch("/api/admin/canvassers").then((r) => r.json()).then((d) => setRows(d.canvassers || [])).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);
  const call = async (init: RequestInit, id: string) => { setBusy(id); setError(null); setNotice(null); try { const r = await fetch("/api/admin/canvassers", { headers: { "Content-Type": "application/json" }, ...init }); const d = await r.json(); if (!r.ok || d.error) { setError(d.error || "Request failed"); return null; } return d; } finally { setBusy(null); } };
  async function add(e: React.FormEvent) { e.preventDefault(); const d = await call({ method: "POST", body: JSON.stringify(form) }, "add"); if (d) { setNotice(d.invited ? `Invite emailed to ${form.email}.` : `Created, but the invite email failed: ${d.inviteError || "unknown"}. Use Resend.`); setForm({ name: "", email: "" }); setShowAdd(false); await load(); } }
  async function act(c: C, action: string) { const d = await call({ method: "PATCH", body: JSON.stringify({ id: c.id, action }) }, c.id); if (d) { if (action === "resend") setNotice(d.ok ? `Invite re-sent to ${c.email}.` : `Resend failed: ${d.error || "unknown"}`); await load(); } }
  async function remove(c: C) { if (!confirm(`Delete canvasser ${c.email}? Their leads stay; the login is removed.`)) return; const d = await call({ method: "DELETE", body: JSON.stringify({ id: c.id }) }, c.id); if (d) await load(); }

  return (
    <div className="dgs-card p-6" id="canvassers">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><Footprints className="w-5 h-5 text-amber-600" /></div>
          <div><h2 className="text-lg font-semibold text-navy-900">Canvasser accounts</h2><p className="text-sm text-gray-500">Field reps who use the canvasser app. They set their own password from the invite email. <Link href="/admin/canvassers" className="text-teal-700 hover:underline">Territories and map →</Link></p></div>
        </div>
        <button onClick={() => setShowAdd((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700"><UserPlus className="w-4 h-4" /> Invite canvasser</button>
      </div>
      {error && <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {notice && <div className="p-3 mb-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">{notice}</div>}
      {showAdd && (
        <form onSubmit={add} className="p-4 mb-4 rounded-lg border border-gray-200 bg-gray-50 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} /></div>
          <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg bg-white">Cancel</button><button type="submit" disabled={busy === "add"} className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">{busy === "add" ? "Sending…" : "Send invite"}</button></div>
        </form>
      )}
      {loading ? <p className="text-sm text-gray-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p> : rows.length === 0 ? <p className="text-sm text-gray-500">No canvasser accounts yet.</p> : (
        <div className="overflow-x-auto"><table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100"><tr>{["Canvasser", "Status", "Last login", "Actions"].map((h) => <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3"><p className="font-medium text-navy-900">{c.name}</p><p className="text-sm text-gray-500 break-all">{c.email}</p></td>
                <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${BADGE[c.status]}`}>{c.status}</span></td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{c.lastLoginAt ? new Date(c.lastLoginAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">
                  {c.status === "invited" && <button onClick={() => act(c, "resend")} disabled={!!busy} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"><Send className="w-3.5 h-3.5" /> Resend invite</button>}
                  <button onClick={() => act(c, c.status === "inactive" ? "activate" : "deactivate")} disabled={!!busy} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"><Power className="w-3.5 h-3.5" /> {c.status === "inactive" ? "Activate" : "Deactivate"}</button>
                  <button onClick={() => remove(c)} disabled={!!busy} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                </div></td>
              </tr>
            ))}
          </tbody></table></div>
      )}
    </div>
  );
}
