"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Search, Upload, Loader2, Users, X } from "lucide-react";

interface Contact { id: string; email: string; firstName: string | null; lastName: string | null; status: string; source: string | null; createdAt: string }
interface Stats { total: number; subscribed: number; unsubscribed: number }

// tiny CSV parser (quoted fields safe)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export default function EmailContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, subscribed: 0, unsubscribed: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "" });
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (statusFilter !== "all") p.set("status", statusFilter);
    fetch(`/api/admin/email-contacts?${p}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d) { setContacts(d.contacts); setStats(d.stats); }
    }).finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [search, statusFilter]);

  async function addContact() {
    if (!form.email.trim()) return;
    const res = await fetch("/api/admin/email-contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { setAdding(false); setForm({ email: "", firstName: "", lastName: "" }); load(); }
  }
  async function toggleStatus(c: Contact) {
    const status = c.status === "SUBSCRIBED" ? "UNSUBSCRIBED" : "SUBSCRIBED";
    const res = await fetch(`/api/admin/email-contacts/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (res.ok) load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this contact?")) return;
    const res = await fetch(`/api/admin/email-contacts/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportMsg(null);
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) { setImportMsg("CSV has no rows."); return; }
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const emailCol = header.findIndex((h) => /e-?mail/.test(h));
      const firstCol = header.findIndex((h) => /first|prenom|fname|given/.test(h));
      const lastCol = header.findIndex((h) => /last|surname|nom|lname|family/.test(h));
      const unsubCol = header.findIndex((h) => /blacklist|blocklist|unsub|opt[-_ ]?out|opted[-_ ]?out|blocked/.test(h));
      if (emailCol === -1) { setImportMsg(`No email column found. Headers: ${header.join(", ")}`); return; }
      const truthy = (v: string) => /^(1|true|yes|y|blacklisted|unsubscribed)$/i.test((v || "").trim());
      const contacts = rows.slice(1).map((r) => ({
        email: r[emailCol],
        firstName: firstCol !== -1 ? r[firstCol] : undefined,
        lastName: lastCol !== -1 ? r[lastCol] : undefined,
        unsubscribed: unsubCol !== -1 ? truthy(r[unsubCol]) : false,
      })).filter((c) => c.email?.includes("@"));
      const res = await fetch("/api/admin/email-contacts/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contacts }) });
      const d = await res.json();
      if (res.ok) { setImportMsg(`Imported ${d.imported} contacts (${d.unsubscribed} unsubscribed, ${d.skipped} skipped).`); load(); }
      else setImportMsg(d.error || "Import failed.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/email" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600" /></Link>
          <div>
            <h1 className="text-2xl font-bold text-navy-900">Contacts</h1>
            <p className="text-navy-600 text-sm mt-1">{stats.subscribed} subscribed · {stats.unsubscribed} unsubscribed</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          <button onClick={() => fileRef.current?.click()} disabled={importing} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-navy-900 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50">
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import CSV
          </button>
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      {importMsg && <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2 text-sm text-teal-900">{importMsg}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
          <option value="all">All</option>
          <option value="SUBSCRIBED">Subscribed</option>
          <option value="UNSUBSCRIBED">Unsubscribed</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-teal-600" /></div>
        ) : contacts.length === 0 ? (
          <div className="p-12 text-center text-gray-500"><Users className="w-9 h-9 text-gray-300 mx-auto mb-2" />No contacts. Import a CSV from Brevo or add one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100"><tr>
                {["Email", "Name", "Status", "Source", ""].map((h) => <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-navy-900">{c.email}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-6 py-3">
                      <button onClick={() => toggleStatus(c)} className={`px-2 py-0.5 text-xs font-medium rounded-full ${c.status === "SUBSCRIBED" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`} title="Click to toggle">
                        {c.status === "SUBSCRIBED" ? "Subscribed" : "Unsubscribed"}
                      </button>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">{c.source || "—"}</td>
                    <td className="px-6 py-3 text-right"><button onClick={() => remove(c.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setAdding(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-navy-900">Add contact</h2><button onClick={() => setAdding(false)}><X className="w-5 h-5 text-gray-500" /></button></div>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email *" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" />
            <div className="grid grid-cols-2 gap-2">
              <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="First name" className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" />
              <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Last name" className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" />
            </div>
            <button onClick={addContact} className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium">Add contact</button>
          </div>
        </div>
      )}
    </div>
  );
}
