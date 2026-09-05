"use client";

import { useEffect, useState } from "react";
import { UserPlus, KeyRound, Trash2, Loader2, Copy, Check, RefreshCw, Users } from "lucide-react";

interface U { id: string; email: string; name: string | null; createdAt: string }
const input = "w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent";
const label = "block text-sm font-medium text-gray-700 mb-1";
function genPassword() {
  const a = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const v = new Uint32Array(14); crypto.getRandomValues(v);
  return Array.from(v, (x) => a[x % a.length]).join("").replace(/(.{5})/g, "$1-").replace(/-$/, "");
}

/** Add, reset, and remove CRM admin accounts. */
export function AdminUsersCard() {
  const [users, setUsers] = useState<U[]>([]); const [me, setMe] = useState("");
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" }); const [showAdd, setShowAdd] = useState(false);
  const [reveal, setReveal] = useState<{ email: string; password: string } | null>(null); const [copied, setCopied] = useState(false);

  const load = () => fetch("/api/admin/users").then((r) => r.json()).then((d) => { setUsers(d.users || []); setMe(d.me || ""); }).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setBusy("add"); setError(null);
    try {
      const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json(); if (!r.ok) { setError(d.error || "Could not add user"); return; }
      setReveal({ email: form.email, password: form.password }); setForm({ name: "", email: "", password: "" }); setShowAdd(false); await load();
    } finally { setBusy(null); }
  }
  async function reset(u: U) {
    if (!confirm(`Set a new password for ${u.email}? The old one stops working immediately.`)) return;
    const password = genPassword(); setBusy(u.id); setError(null);
    try {
      const r = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id, password }) });
      const d = await r.json(); if (!r.ok) { setError(d.error || "Could not reset"); return; }
      setReveal({ email: u.email, password });
    } finally { setBusy(null); }
  }
  async function remove(u: U) {
    if (!confirm(`Delete ${u.email}? They lose access immediately.`)) return;
    setBusy(u.id); setError(null);
    try {
      const r = await fetch("/api/admin/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id }) });
      const d = await r.json(); if (!r.ok) { setError(d.error || "Could not delete"); return; }
      await load();
    } finally { setBusy(null); }
  }
  const copy = async () => { if (!reveal) return; await navigator.clipboard.writeText(`${reveal.email}\n${reveal.password}`).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className="dgs-card p-6" id="users">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center"><Users className="w-5 h-5 text-violet-600" /></div>
          <div><h2 className="text-lg font-semibold text-navy-900">Admin users</h2><p className="text-sm text-gray-500">Everyone who can sign in to this dashboard. All admins have full access.</p></div>
        </div>
        <button onClick={() => setShowAdd((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700"><UserPlus className="w-4 h-4" /> Add user</button>
      </div>
      {error && <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {reveal && (
        <div className="p-4 mb-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-semibold text-green-800">Share these once. The password isn&apos;t shown again.</p>
          <p className="mt-1 font-mono text-sm text-navy-900 break-all">{reveal.email}</p><p className="font-mono text-sm text-navy-900 break-all">{reveal.password}</p>
          <div className="flex gap-2 mt-2"><button onClick={copy} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-green-300 text-green-800">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copied" : "Copy both"}</button><button onClick={() => setReveal(null)} className="px-2.5 py-1 text-xs text-gray-600">Dismiss</button></div>
        </div>
      )}
      {showAdd && (
        <form onSubmit={add} className="p-4 mb-4 rounded-lg border border-gray-200 bg-gray-50 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className={label}>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} placeholder="Optional" /></div>
          <div><label className={label}>Email *</label><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} /></div>
          <div><label className={label}>Password * <span className="text-gray-400 font-normal">(10+ chars)</span></label>
            <div className="flex gap-2"><input required minLength={10} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={input} /><button type="button" onClick={() => setForm({ ...form, password: genPassword() })} title="Generate" className="px-2.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100"><RefreshCw className="w-4 h-4" /></button></div></div>
          <div className="sm:col-span-3 flex justify-end gap-2"><button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg bg-white">Cancel</button><button type="submit" disabled={busy === "add"} className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">{busy === "add" ? "Adding…" : "Create user"}</button></div>
        </form>
      )}
      {loading ? <p className="text-sm text-gray-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p> : (
        <div className="overflow-x-auto"><table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100"><tr>{["User", "Added", "Actions"].map((h) => <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3"><p className="font-medium text-navy-900">{u.name || <span className="text-gray-400">No name</span>}{u.email === me && <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-violet-100 text-violet-800 align-middle">YOU</span>}</p><p className="text-sm text-gray-500 break-all">{u.email}</p></td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                <td className="px-4 py-3"><div className="flex gap-1.5">
                  <button onClick={() => reset(u)} disabled={!!busy} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"><KeyRound className="w-3.5 h-3.5" /> Reset password</button>
                  <button onClick={() => remove(u)} disabled={!!busy || u.email === me || users.length <= 1} title={u.email === me ? "You can't delete yourself" : ""} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                </div></td>
              </tr>
            ))}
          </tbody></table></div>
      )}
    </div>
  );
}
