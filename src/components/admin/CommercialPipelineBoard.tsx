"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Calendar, DollarSign, MoreHorizontal, Phone } from "lucide-react";


/**
 * Commercial pipeline. Columns are the lead statuses, named the way a
 * commercial deal moves: inquiry → contacted → proposal sent → won, with
 * no-answer and lost off to the side. Drag a card to move it; the status
 * update goes through the same route the lead page's status form uses.
 */
export interface BoardLead {
  id: string;
  propertyName: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  status: string;
  grade: string | null;
  followupDate: string | null;
  createdAt: string;
  updatedAt: string;
  quotedMonthly: number | null; // from the saved community quote, if any
}

const COLUMNS: { status: string; name: string; hint: string; color: string; optional?: boolean }[] = [
  { status: "PHONE_REVIEW", name: "Phone review", hint: "Created from a call by AI — needs a look", color: "yellow", optional: true },
  { status: "NEW", name: "New inquiry", hint: "Just came in", color: "teal" },
  { status: "CONTACTED", name: "Contacted", hint: "We've spoken", color: "blue" },
  { status: "NO_ANSWER", name: "No answer", hint: "Keep trying", color: "orange" },
  { status: "WAITING_FOR_SIGNUP", name: "Proposal sent", hint: "Waiting on the board / manager", color: "purple" },
  { status: "CONVERTED", name: "Won", hint: "Signed", color: "green" },
  { status: "NOT_INTERESTED", name: "Lost", hint: "Declined or went elsewhere", color: "gray" },
];
const C: Record<string, { header: string; border: string; text: string; bg: string }> = {
  teal:   { header: "bg-teal-100",   border: "border-teal-200",   text: "text-teal-800",   bg: "bg-teal-50" },
  blue:   { header: "bg-blue-100",   border: "border-blue-200",   text: "text-blue-800",   bg: "bg-blue-50" },
  orange: { header: "bg-orange-100", border: "border-orange-200", text: "text-orange-800", bg: "bg-orange-50" },
  gray:   { header: "bg-gray-100",   border: "border-gray-200",   text: "text-gray-700",   bg: "bg-gray-50" },
  purple: { header: "bg-purple-100", border: "border-purple-200", text: "text-purple-800", bg: "bg-purple-50" },
  green:  { header: "bg-green-100",  border: "border-green-200",  text: "text-green-800",  bg: "bg-green-50" },
  yellow: { header: "bg-yellow-100", border: "border-yellow-200", text: "text-yellow-800", bg: "bg-yellow-50" },
};
const GRADE: Record<string, string> = { A: "bg-green-100 text-green-800", B: "bg-teal-100 text-teal-800", C: "bg-yellow-100 text-yellow-800", D: "bg-orange-100 text-orange-800", F: "bg-red-100 text-red-800" };
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const ago = (iso: string) => { const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000); return d <= 0 ? "today" : d === 1 ? "1 day" : `${d} days`; };

export function CommercialPipelineBoard({ leads: initial }: { leads: BoardLead[] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byStatus = useMemo(() => {
    const m: Record<string, BoardLead[]> = {};
    for (const l of leads) (m[l.status] ||= []).push(l);
    // Overdue follow-ups float to the top of their column, then newest first.
    for (const k in m) m[k].sort((a, b) => {
      const ao = a.followupDate && new Date(a.followupDate) < new Date() ? 0 : 1;
      const bo = b.followupDate && new Date(b.followupDate) < new Date() ? 0 : 1;
      return ao - bo || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return m;
  }, [leads]);
  const columns = COLUMNS.filter((c) => !c.optional || (byStatus[c.status]?.length ?? 0) > 0);
  const pipelineValue = leads.filter((l) => !["CONVERTED", "NOT_INTERESTED"].includes(l.status) && l.quotedMonthly).reduce((s, l) => s + (l.quotedMonthly || 0), 0);
  const wonValue = leads.filter((l) => l.status === "CONVERTED" && l.quotedMonthly).reduce((s, l) => s + (l.quotedMonthly || 0), 0);

  async function move(id: string, status: string) {
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.status === status) return;
    const prev = lead.status;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status, updatedAt: new Date().toISOString() } : l)));
    setError(null);
    const r = await fetch("/api/admin/update-lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: id, leadType: "commercial", status }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.success) { setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status: prev } : l))); setError(d.message || "Could not move that lead"); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>Drag a card to another column to update its status, or use the menu on a card.</span>
        <span className="inline-flex items-center gap-3">
          <span><b className="text-navy-900">{money(pipelineValue)}</b>/mo open pipeline</span>
          <span><b className="text-green-700">{money(wonValue)}</b>/mo won</span>
          <span className="text-gray-400">(from saved quotes)</span>
        </span>
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      <div className="overflow-x-auto pb-4 -mx-4 px-4">
        <div className="flex gap-4 items-start" style={{ minWidth: `${columns.length * 272}px` }}>
          {columns.map((col) => {
            const c = C[col.color]; const items = byStatus[col.status] ?? []; const isOver = over === col.status;
            return (
              <div key={col.status} className="flex-shrink-0 w-64"
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== col.status) setOver(col.status); }}
                onDragLeave={() => setOver((o) => (o === col.status ? null : o))}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || dragging; setOver(null); setDragging(null); if (id) void move(id, col.status); }}
              >
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${c.header} border-x border-t ${c.border}`}>
                  <div className="min-w-0"><p className={`text-sm font-semibold ${c.text} truncate`}>{col.name}</p><p className={`text-[10px] ${c.text} opacity-70 truncate`}>{col.hint}</p></div>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full bg-white/70 ${c.text} flex-shrink-0 ml-2`}>{items.length}</span>
                </div>
                <div className={`min-h-[140px] p-2 space-y-2 rounded-b-xl border ${c.border} ${isOver ? "bg-white ring-2 ring-teal-400" : c.bg} transition-colors`}>
                  {items.length === 0 && <p className="text-xs text-gray-400 text-center py-6">Drop a lead here</p>}
                  {items.map((lead) => {
                    const overdue = !!lead.followupDate && new Date(lead.followupDate) < new Date();
                    return (
                      <div key={lead.id} draggable
                        onDragStart={(e) => { setDragging(lead.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", lead.id); }}
                        onDragEnd={() => { setDragging(null); setOver(null); }}
                        onClick={() => router.push(`/admin/leads/commercial/${lead.id}`)}
                        className={`bg-white rounded-lg border border-gray-200 shadow-sm p-3 cursor-grab active:cursor-grabbing hover:border-teal-300 transition-all ${dragging === lead.id ? "opacity-40" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-navy-900 truncate">{lead.propertyName}</p>
                            <p className="text-xs text-gray-500 truncate">{lead.contactName}{lead.city ? ` · ${lead.city}` : ""}</p>
                          </div>
                          <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <select
                              aria-label="Move to"
                              value={lead.status}
                              onChange={(e) => void move(lead.id, e.target.value)}
                              className="absolute inset-0 opacity-0 cursor-pointer w-7 h-7"
                            >
                              {COLUMNS.map((k) => <option key={k.status} value={k.status}>{k.name}</option>)}
                            </select>
                            <span className="p-1 rounded hover:bg-gray-100 inline-flex" title="Move to…"><MoreHorizontal className="w-4 h-4 text-gray-400" /></span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {lead.grade && <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${GRADE[lead.grade] || "bg-gray-100 text-gray-700"}`}>{lead.grade}</span>}
                          {lead.quotedMonthly != null && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-violet-50 text-violet-800"><DollarSign className="w-3 h-3" />{money(lead.quotedMonthly)}/mo</span>}
                          {lead.followupDate && <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded ${overdue ? "bg-red-100 text-red-800" : "bg-teal-50 text-teal-800"}`}><Calendar className="w-3 h-3" />{new Date(lead.followupDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                        </div>
                        <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
                          <span className="inline-flex items-center gap-1 truncate">{lead.phone ? <><Phone className="w-3 h-3" />{lead.phone}</> : <><Building2 className="w-3 h-3" />No phone</>}</span>
                          <span title={`Last updated ${new Date(lead.updatedAt).toLocaleString()}`}>{ago(lead.updatedAt)} in stage</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-gray-400">Cards open the lead. <Link href="/admin/leads/commercial" className="underline">List view</Link> has search, filters and archived leads.</p>
    </div>
  );
}
