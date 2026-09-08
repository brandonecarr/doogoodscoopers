"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, MoreHorizontal, Phone, PhoneCall, ArrowRightCircle } from "lucide-react";
import { PROSPECT_STATUSES, PROSPECT_STATUS_META, PROSPECT_TYPE_LABEL, type ProspectStatus, type ProspectType } from "@/lib/commercial-prospect-types";

/**
 * Call-list pipeline: one column per prospect status (archived stays off the
 * board). Drag a card to move it; the status saves through the same route the
 * prospect page's status form uses.
 */
export interface BoardProspect {
  id: string; propertyName: string; propertyType: string; contactName: string | null; phone: string | null; city: string;
  status: string; grade: string | null; followupDate: string | null; attempts: number; lastAttemptAt: string | null;
  units: number | null; createdAt: string; updatedAt: string; convertedLeadId: string | null;
}

const COLUMNS: { status: ProspectStatus; hint: string; color: string }[] = [
  { status: "TO_CALL", hint: "Not reached yet", color: "teal" },
  { status: "ATTEMPTED", hint: "Called, no answer", color: "orange" },
  { status: "CONTACTED", hint: "Spoke with someone", color: "blue" },
  { status: "INTERESTED", hint: "Wants a proposal or visit", color: "purple" },
  { status: "CONVERTED", hint: "Now a commercial lead", color: "green" },
  { status: "NOT_INTERESTED", hint: "Declined", color: "gray" },
];
const C: Record<string, { header: string; border: string; text: string; bg: string }> = {
  teal:   { header: "bg-teal-100",   border: "border-teal-200",   text: "text-teal-800",   bg: "bg-teal-50" },
  blue:   { header: "bg-blue-100",   border: "border-blue-200",   text: "text-blue-800",   bg: "bg-blue-50" },
  orange: { header: "bg-orange-100", border: "border-orange-200", text: "text-orange-800", bg: "bg-orange-50" },
  gray:   { header: "bg-gray-100",   border: "border-gray-200",   text: "text-gray-700",   bg: "bg-gray-50" },
  purple: { header: "bg-purple-100", border: "border-purple-200", text: "text-purple-800", bg: "bg-purple-50" },
  green:  { header: "bg-green-100",  border: "border-green-200",  text: "text-green-800",  bg: "bg-green-50" },
};
const TYPE_BADGE: Record<string, string> = { HOA: "bg-violet-100 text-violet-800", APARTMENTS: "bg-amber-100 text-amber-800", SENIOR_55: "bg-sky-100 text-sky-800", OTHER: "bg-gray-100 text-gray-700" };
const GRADE: Record<string, string> = { A: "bg-green-100 text-green-800", B: "bg-teal-100 text-teal-800", C: "bg-yellow-100 text-yellow-800", D: "bg-orange-100 text-orange-800", F: "bg-red-100 text-red-800" };
const ago = (iso: string) => { const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000); return d <= 0 ? "today" : d === 1 ? "1 day" : `${d} days`; };
const short = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function ProspectPipelineBoard({ prospects: initial }: { prospects: BoardProspect[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byStatus = useMemo(() => {
    const m: Record<string, BoardProspect[]> = {};
    for (const p of rows) (m[p.status] ||= []).push(p);
    for (const k in m) m[k].sort((a, b) => {
      const ao = a.followupDate && new Date(a.followupDate) < new Date() ? 0 : 1;
      const bo = b.followupDate && new Date(b.followupDate) < new Date() ? 0 : 1;
      return ao - bo || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return m;
  }, [rows]);

  async function move(id: string, status: string) {
    const p = rows.find((x) => x.id === id);
    if (!p || p.status === status) return;
    if (status === "CONVERTED" && !p.convertedLeadId) {
      // Converting creates the commercial lead — that's the Convert action, not a status drag.
      router.push(`/admin/leads/commercial/call-list/${id}`); return;
    }
    const prev = p.status;
    setRows((rs) => rs.map((x) => (x.id === id ? { ...x, status, updatedAt: new Date().toISOString() } : x)));
    setError(null);
    const r = await fetch("/api/admin/update-lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: id, leadType: "prospect", status }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.success) { setRows((rs) => rs.map((x) => (x.id === id ? { ...x, status: prev } : x))); setError(d.message || "Could not move that prospect"); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>Drag a card to another column to update its status, or use the menu on a card. To convert, open the prospect and use Convert to lead.</span>
        <span><b className="text-navy-900">{rows.filter((r) => r.status === "INTERESTED").length}</b> interested · <b className="text-green-700">{rows.filter((r) => r.status === "CONVERTED").length}</b> converted</span>
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      <div className="overflow-x-auto pb-4 -mx-4 px-4">
        <div className="flex gap-4 items-start" style={{ minWidth: `${COLUMNS.length * 272}px` }}>
          {COLUMNS.map((col) => {
            const c = C[col.color]; const items = byStatus[col.status] ?? []; const isOver = over === col.status; const meta = PROSPECT_STATUS_META[col.status];
            return (
              <div key={col.status} className="flex-shrink-0 w-64"
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== col.status) setOver(col.status); }}
                onDragLeave={() => setOver((o) => (o === col.status ? null : o))}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || dragging; setOver(null); setDragging(null); if (id) void move(id, col.status); }}
              >
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${c.header} border-x border-t ${c.border}`}>
                  <div className="min-w-0"><p className={`text-sm font-semibold ${c.text} truncate`}>{meta.label}</p><p className={`text-[10px] ${c.text} opacity-70 truncate`}>{col.hint}</p></div>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full bg-white/70 ${c.text} flex-shrink-0 ml-2`}>{items.length}</span>
                </div>
                <div className={`min-h-[140px] p-2 space-y-2 rounded-b-xl border ${c.border} ${isOver ? "bg-white ring-2 ring-teal-400" : c.bg} transition-colors`}>
                  {items.length === 0 && <p className="text-xs text-gray-400 text-center py-6">Drop a prospect here</p>}
                  {items.map((p) => {
                    const overdue = !!p.followupDate && new Date(p.followupDate) < new Date();
                    return (
                      <div key={p.id} draggable
                        onDragStart={(e) => { setDragging(p.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", p.id); }}
                        onDragEnd={() => { setDragging(null); setOver(null); }}
                        onClick={() => router.push(`/admin/leads/commercial/call-list/${p.id}`)}
                        className={`bg-white rounded-lg border border-gray-200 shadow-sm p-3 cursor-grab active:cursor-grabbing hover:border-teal-300 transition-all ${dragging === p.id ? "opacity-40" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-navy-900 truncate">{p.propertyName}</p>
                            <p className="text-xs text-gray-500 truncate">{p.contactName || "No contact yet"}{p.city ? ` · ${p.city}` : ""}</p>
                          </div>
                          <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <select aria-label="Move to" value={p.status} onChange={(e) => void move(p.id, e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-7 h-7">
                              {PROSPECT_STATUSES.filter((s) => s !== "ARCHIVED").map((s) => <option key={s} value={s}>{PROSPECT_STATUS_META[s].label}</option>)}
                            </select>
                            <span className="p-1 rounded hover:bg-gray-100 inline-flex" title="Move to…"><MoreHorizontal className="w-4 h-4 text-gray-400" /></span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap ${TYPE_BADGE[p.propertyType] || TYPE_BADGE.OTHER}`}>{PROSPECT_TYPE_LABEL[p.propertyType as ProspectType] || p.propertyType}</span>
                          {p.units ? <span className="text-[10px] text-gray-500">{p.units} units</span> : null}
                          {p.grade && <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${GRADE[p.grade] || "bg-gray-100 text-gray-700"}`}>{p.grade}</span>}
                          {p.followupDate && <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded ${overdue ? "bg-red-100 text-red-800" : "bg-teal-50 text-teal-800"}`}><Calendar className="w-3 h-3" />{short(p.followupDate)}</span>}
                          {p.convertedLeadId && <Link href={`/admin/leads/commercial/${p.convertedLeadId}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-green-50 text-green-800 hover:bg-green-100"><ArrowRightCircle className="w-3 h-3" />Open lead</Link>}
                        </div>
                        <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
                          <span className="inline-flex items-center gap-1 truncate">{p.phone ? <><Phone className="w-3 h-3" />{p.phone}</> : "No phone"}</span>
                          <span className="inline-flex items-center gap-1" title={p.lastAttemptAt ? `Last call ${new Date(p.lastAttemptAt).toLocaleString()}` : "No calls logged"}><PhoneCall className="w-3 h-3" />{p.attempts} · {ago(p.updatedAt)}</span>
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
      <p className="text-[11px] text-gray-400">Cards open the prospect. <Link href="/admin/leads/commercial/call-list" className="underline">List view</Link> has search, filters, upload and archived prospects.</p>
    </div>
  );
}
