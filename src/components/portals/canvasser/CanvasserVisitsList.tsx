"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowDownUp, MapPin, Sparkles, X, ChevronRight } from "lucide-react";

export interface VisitItem {
  id: string;
  address: string | null;
  city: string | null;
  zipCode: string | null;
  status: string;
  notes: string | null;
  aiNotes: string | null;
  lat: number;
  lng: number;
  createdAt: string; // ISO
}

const STATUS: { id: string; label: string; color: string }[] = [
  { id: "NOT_HOME", label: "Not home", color: "#9CA3AF" },
  { id: "CALLBACK", label: "Call back", color: "#F59E0B" },
  { id: "INTERESTED", label: "Interested", color: "#2563EB" },
  { id: "NOT_INTERESTED", label: "Not interested", color: "#EF4444" },
  { id: "LEAD", label: "Lead", color: "#16A34A" },
  { id: "DO_NOT_KNOCK", label: "Do not knock", color: "#111827" },
];
const meta = (s: string) => STATUS.find((x) => x.id === s) ?? { id: s, label: s, color: "#9CA3AF" };

function when(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function CanvasserVisitsList({ visits }: { visits: VisitItem[] }) {
  const [filter, setFilter] = useState<string>(""); // status id or ""
  const [sortDesc, setSortDesc] = useState(true); // newest first
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const v of visits) c[v.status] = (c[v.status] ?? 0) + 1;
    return c;
  }, [visits]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = visits.filter((v) => {
      if (filter && v.status !== filter) return false;
      if (!needle) return true;
      const hay = [v.address, v.city, v.zipCode, v.notes, v.aiNotes, meta(v.status).label, `${v.lat},${v.lng}`]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(needle);
    });
    list = list.slice().sort((a, b) => {
      const d = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDesc ? -d : d;
    });
    return list;
  }, [visits, filter, q, sortDesc]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-[16px] font-extrabold text-gray-900">All Pins <span className="text-gray-400 font-semibold">({visits.length})</span></h1>
        <button onClick={() => setSortDesc((s) => !s)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
          <ArrowDownUp className="w-3.5 h-3.5" /> {sortDesc ? "Newest" : "Oldest"}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search address, notes, AI notes…"
          className="w-full pl-9 pr-9 py-2.5 text-[14px] bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-violet-300"
        />
        {q && <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400"><X className="w-4 h-4" /></button>}
      </div>

      {/* Category filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        <button onClick={() => setFilter("")} className="flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border"
          style={filter === "" ? { background: "#6D3EF0", color: "#fff", borderColor: "#6D3EF0" } : { color: "#6B7280", borderColor: "#E5E7EB", background: "#fff" }}>
          All ({visits.length})
        </button>
        {STATUS.map((s) => (
          <button key={s.id} onClick={() => setFilter(filter === s.id ? "" : s.id)} className="flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border"
            style={filter === s.id ? { background: s.color, color: "#fff", borderColor: s.color } : { color: s.color, borderColor: "#E5E7EB", background: "#fff" }}>
            {s.label} ({counts[s.id] ?? 0})
          </button>
        ))}
      </div>

      {/* List */}
      {shown.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
          <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-[13.5px] text-gray-500">{visits.length === 0 ? "No pins yet. Drop one on the map and it'll show up here." : "No pins match your search or filter."}</p>
        </div>
      ) : (
        shown.map((v) => {
          const m = meta(v.status);
          const loc = [v.city, v.zipCode].filter(Boolean).join(", ");
          return (
            <Link key={v.id} href={`/app/canvasser/pin/${v.id}`} className="block bg-white rounded-2xl p-3.5 border border-gray-100 active:bg-gray-50">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[14px] font-bold text-gray-900 min-w-0 flex-1 truncate">{v.address || `${v.lat.toFixed(5)}, ${v.lng.toFixed(5)}`}</p>
                <span className="inline-flex items-center gap-1 flex-shrink-0">
                  <span className="text-[10.5px] font-bold rounded-full px-2 py-0.5" style={{ color: "#fff", background: m.color }}>{m.label}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </span>
              </div>
              {loc && <p className="text-[12px] text-gray-500 mt-0.5">{loc}</p>}
              {v.notes && <p className="text-[12.5px] text-gray-700 mt-1.5 whitespace-pre-wrap line-clamp-3">{v.notes}</p>}
              {v.aiNotes && (
                <div className="mt-1.5 rounded-lg bg-violet-50/60 border border-violet-100 p-2">
                  <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wide flex items-center gap-1 mb-0.5"><Sparkles className="w-3 h-3" /> AI notes</p>
                  <p className="text-[12px] text-gray-700 whitespace-pre-wrap line-clamp-4">{v.aiNotes}</p>
                </div>
              )}
              <p className="text-[11px] text-gray-400 mt-1.5">{when(v.createdAt)}</p>
            </Link>
          );
        })
      )}
    </div>
  );
}
