"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Search,
  Filter,
  Loader2,
  LayoutList,
  LayoutGrid,
  Map as MapIcon,
  Plus,
  MoreHorizontal,
  FileText,
  Megaphone,
  Instagram,
  MapPin,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  CheckSquare,
  Archive,
  X,
} from "lucide-react";
import type { LeadStatus } from "@/types/leads";
import { CallIntelCard } from "@/components/admin/CallIntelCard";
import type { MapPoint } from "@/components/admin/LeadsMap";

// mapbox-gl is heavy and touches window — load it only when the Map view opens.
const LeadsMap = dynamic(() => import("@/components/admin/LeadsMap").then((m) => m.LeadsMap), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center bg-white rounded-xl border border-gray-100" style={{ height: "70vh" }}><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>,
});

type LeadsView = "list" | "kanban" | "map";
interface MapMeta { configured: boolean; totalLeads: number; mappedLeads: number; noZip: number; ungeocoded: number }

// ─── Types ────────────────────────────────────────────────────────────────────

interface CombinedLead {
  id: string;
  type: "quote" | "ad" | "instagram" | "canvasser";
  name: string;
  phone: string | null;
  email: string | null;
  zipCode: string | null;
  status: LeadStatus;
  grade: string | null;
  source: string;
  createdAt: string;
  followupDate: string | null;
  archived: boolean;
}

// Source badge styling/icon/label by lead type.
const typeBadgeClass = (t: CombinedLead["type"]) =>
  t === "quote" ? "bg-blue-100 text-blue-800"
  : t === "instagram" ? "bg-purple-100 text-purple-800"
  : t === "canvasser" ? "bg-amber-100 text-amber-800"
  : "bg-pink-100 text-pink-800";
const TypeIcon = ({ type }: { type: CombinedLead["type"] }) =>
  type === "quote" ? <FileText className="w-3 h-3" />
  : type === "instagram" ? <Instagram className="w-3 h-3" />
  : type === "canvasser" ? <MapPin className="w-3 h-3" />
  : <Megaphone className="w-3 h-3" />;
const typeShortLabel = (t: CombinedLead["type"]) =>
  t === "quote" ? "Quote" : t === "instagram" ? "Instagram" : t === "canvasser" ? "Canvasser" : "Ad";

type ColorKey =
  | "teal" | "blue" | "orange" | "gray" | "purple"
  | "green" | "red" | "yellow" | "pink" | "indigo";

interface KanbanColumn {
  id: string;
  name: string;
  color: ColorKey;
  statusMapping?: LeadStatus;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMN_COLORS: Record<ColorKey, { header: string; border: string; text: string; bg: string }> = {
  teal:   { header: "bg-teal-100",   border: "border-teal-200",   text: "text-teal-800",   bg: "bg-teal-50" },
  blue:   { header: "bg-blue-100",   border: "border-blue-200",   text: "text-blue-800",   bg: "bg-blue-50" },
  orange: { header: "bg-orange-100", border: "border-orange-200", text: "text-orange-800", bg: "bg-orange-50" },
  gray:   { header: "bg-gray-100",   border: "border-gray-200",   text: "text-gray-700",   bg: "bg-gray-50" },
  purple: { header: "bg-purple-100", border: "border-purple-200", text: "text-purple-800", bg: "bg-purple-50" },
  green:  { header: "bg-green-100",  border: "border-green-200",  text: "text-green-800",  bg: "bg-green-50" },
  red:    { header: "bg-red-100",    border: "border-red-200",    text: "text-red-800",    bg: "bg-red-50" },
  yellow: { header: "bg-yellow-100", border: "border-yellow-200", text: "text-yellow-800", bg: "bg-yellow-50" },
  pink:   { header: "bg-pink-100",   border: "border-pink-200",   text: "text-pink-800",   bg: "bg-pink-50" },
  indigo: { header: "bg-indigo-100", border: "border-indigo-200", text: "text-indigo-800", bg: "bg-indigo-50" },
};

const COLOR_OPTIONS: ColorKey[] = ["teal", "blue", "orange", "gray", "purple", "green", "red", "yellow", "pink", "indigo"];

// Pipeline stages left→right. Each maps to a real LeadStatus so a move updates status.
const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "phone_review",   name: "Phone Review Leads", color: "yellow", statusMapping: "PHONE_REVIEW" },
  { id: "new",            name: "New",       color: "teal",   statusMapping: "NEW" },
  { id: "contacted",      name: "Contacted", color: "blue",   statusMapping: "CONTACTED" },
  { id: "no_answer",      name: "No Answer", color: "orange", statusMapping: "NO_ANSWER" },
  { id: "waiting",        name: "Quoted",    color: "purple", statusMapping: "WAITING_FOR_SIGNUP" },
  { id: "converted",      name: "Won",       color: "green",  statusMapping: "CONVERTED" },
  { id: "not_interested", name: "Lost",      color: "red",    statusMapping: "NOT_INTERESTED" },
];

const LS_COLUMNS     = "dgs_kanban_columns";
const LS_ASSIGNMENTS = "dgs_kanban_assignments";
const LS_VIEW        = "dgs_leads_view";
const LS_WINDOW      = "dgs_leads_window";
const LS_SORT        = "dgs_leads_sort";
const LS_PAGESIZE    = "dgs_leads_pagesize";

const PAGE_SIZES = [10, 20, 50, 100];

const PER_PAGE   = 4; // cards shown per column page
const DOT_WINDOW = 5; // max page-dots shown at once

// ─── Helpers ──────────────────────────────────────────────────────────────────

function leadKey(lead: CombinedLead) {
  return `${lead.type}:${lead.id}`;
}

/**
 * Columns live in localStorage, so a board saved before PHONE_REVIEW existed has
 * no column mapped to it — and a column the user added by hand has no
 * statusMapping at all, which means server-created phone leads could never land
 * in it. Reconcile on load: adopt a hand-made "phone review"-ish column by
 * attaching the mapping, otherwise prepend the default one.
 */
function reconcileColumns(stored: KanbanColumn[]): KanbanColumn[] {
  if (stored.some((c) => c.statusMapping === "PHONE_REVIEW")) return stored;
  const byName = stored.find((c) => !c.statusMapping && /phone/i.test(c.name));
  if (byName) {
    return stored.map((c) => (c.id === byName.id ? { ...c, statusMapping: "PHONE_REVIEW" as LeadStatus } : c));
  }
  return [DEFAULT_COLUMNS[0], ...stored];
}

function getLeadColumnId(lead: CombinedLead, assignments: Record<string, string>, columns: KanbanColumn[]): string {
  const assigned = assignments[leadKey(lead)];
  if (assigned && columns.find((c) => c.id === assigned)) return assigned;
  const byStatus = columns.find((c) => c.statusMapping === lead.status);
  if (byStatus) return byStatus.id;
  return columns[0]?.id ?? "";
}

// Windowed page-dot indices (max DOT_WINDOW), centered on the current page.
function pageDots(page: number, totalPages: number): number[] {
  const size = Math.min(DOT_WINDOW, totalPages);
  const start = Math.min(Math.max(0, page - Math.floor(size / 2)), Math.max(0, totalPages - size));
  return Array.from({ length: size }, (_, i) => start + i);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: LeadStatus }) {
  const styles: Record<LeadStatus, string> = {
    NEW: "bg-teal-100 text-teal-800",
    CONTACTED: "bg-blue-100 text-blue-800",
    NO_ANSWER: "bg-orange-100 text-orange-800",
    NOT_INTERESTED: "bg-gray-100 text-gray-800",
    WAITING_FOR_SIGNUP: "bg-purple-100 text-purple-800",
    CONVERTED: "bg-green-100 text-green-800",
    PHONE_REVIEW: "bg-yellow-100 text-yellow-800",
  };
  const labels: Record<LeadStatus, string> = {
    NEW: "New", CONTACTED: "Contacted", NO_ANSWER: "No Answer",
    NOT_INTERESTED: "Not Interested", WAITING_FOR_SIGNUP: "Waiting for Signup", CONVERTED: "Converted",
    PHONE_REVIEW: "Phone Review",
  };
  return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status]}`}>{labels[status]}</span>;
}

function GradeBadge({ grade }: { grade: string | null | undefined }) {
  if (!grade) return null;
  const styles: Record<string, string> = {
    A: "bg-green-100 text-green-800", B: "bg-teal-100 text-teal-800", C: "bg-yellow-100 text-yellow-800",
    D: "bg-orange-100 text-orange-800", F: "bg-red-100 text-red-800",
  };
  return <span className={`px-2 py-0.5 text-xs font-bold rounded ${styles[grade] ?? "bg-gray-100 text-gray-800"}`}>{grade}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LeadsPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [leads,        setLeads]        = useState<CombinedLead[]>([]);
  const [total,        setTotal]        = useState(0);
  const [counts,       setCounts]       = useState<Record<string, number>>({});
  const [loadingMore,  setLoadingMore]  = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [view,         setView]         = useState<LeadsView>("list");
  const [mapPoints,    setMapPoints]    = useState<MapPoint[]>([]);
  const [mapMeta,      setMapMeta]      = useState<MapMeta | null>(null);
  const [mapLoading,   setMapLoading]   = useState(false);
  const [convertedOnly, setConvertedOnly] = useState(false);
  const [searchValue,  setSearchValue]  = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [sourceFilter, setSourceFilter] = useState(searchParams.get("source") || "all");
  const [windowDays,   setWindowDays]   = useState(0); // 0 = all time
  const [sortBy,       setSortBy]       = useState<"newest" | "grade">("newest");

  // Kanban state
  const [columns,      setColumns]      = useState<KanbanColumn[]>(DEFAULT_COLUMNS);
  const [assignments,  setAssignments]  = useState<Record<string, string>>({});
  const [addingCol,    setAddingCol]    = useState(false);
  const [newColName,   setNewColName]   = useState("");
  const [newColColor,  setNewColColor]  = useState<ColorKey>("blue");
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editColName,  setEditColName]  = useState("");
  const [openColMenu,  setOpenColMenu]  = useState<string | null>(null);
  const [pageByCol,    setPageByCol]    = useState<Record<string, number>>({});

  // Drag + selection
  const [draggedKey,   setDraggedKey]   = useState<string | null>(null);
  const [dragOverCol,  setDragOverCol]  = useState<string | null>(null);
  const [selectMode,   setSelectMode]   = useState(false);
  const [selected,     setSelected]     = useState<Set<string>>(new Set());

  const currentPage = parseInt(searchParams.get("page") || "1");
  const [pageSize, setPageSize] = useState(20);

  // Load persisted prefs
  useEffect(() => {
    try {
      const storedCols = localStorage.getItem(LS_COLUMNS);
      if (storedCols) {
        const parsed = JSON.parse(storedCols) as KanbanColumn[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const reconciled = reconcileColumns(parsed);
          setColumns(reconciled);
          // Persist so the phone-review mapping sticks for next load.
          if (reconciled !== parsed) localStorage.setItem(LS_COLUMNS, JSON.stringify(reconciled));
        }
      }
      const storedAssign = localStorage.getItem(LS_ASSIGNMENTS);
      if (storedAssign) setAssignments(JSON.parse(storedAssign));
      const storedView = localStorage.getItem(LS_VIEW);
      if (storedView === "kanban" || storedView === "list" || storedView === "map") setView(storedView);
      const storedWindow = localStorage.getItem(LS_WINDOW);
      if (storedWindow) setWindowDays(parseInt(storedWindow) || 0);
      const storedSort = localStorage.getItem(LS_SORT);
      if (storedSort === "grade" || storedSort === "newest") setSortBy(storedSort);
      const storedPageSize = localStorage.getItem(LS_PAGESIZE);
      if (storedPageSize && PAGE_SIZES.includes(parseInt(storedPageSize))) setPageSize(parseInt(storedPageSize));
    } catch {}
  }, []);

  function selectView(v: LeadsView) {
    setView(v);
    if (v !== "kanban") { setSelectMode(false); setSelected(new Set()); }
    try { localStorage.setItem(LS_VIEW, v); } catch {}
  }
  function changeWindow(d: number) {
    setWindowDays(d);
    try { localStorage.setItem(LS_WINDOW, String(d)); } catch {}
  }
  function changePageSize(n: number) {
    setPageSize(n);
    try { localStorage.setItem(LS_PAGESIZE, String(n)); } catch {}
    // Jump back to page 1 so we're never stranded on a now-out-of-range page.
    if (currentPage !== 1) {
      const params = new URLSearchParams();
      if (searchValue) params.set("search", searchValue);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (sourceFilter && sourceFilter !== "all") params.set("source", sourceFilter);
      router.push(`/admin/leads?${params}`);
    }
  }
  function changeSort(s: "newest" | "grade") {
    setSortBy(s);
    try { localStorage.setItem(LS_SORT, s); } catch {}
  }

  // Shared query params for the current filters.
  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    if (statusFilter && statusFilter !== "all") p.set("status", statusFilter);
    if (sourceFilter && sourceFilter !== "all") p.set("source", sourceFilter);
    if (searchValue) p.set("search", searchValue);
    if (windowDays > 0) p.set("days", String(windowDays));
    if (sortBy !== "newest") p.set("sort", sortBy);
    return p;
  }, [statusFilter, sourceFilter, searchValue, windowDays, sortBy]);

  const fetchLeads = useCallback(async () => {
    if (view === "map") return; // map has its own fetch
    setLoading(true);
    try {
      const params = buildParams();
      if (view === "kanban") params.set("view", "kanban");
      else { params.set("page", currentPage.toString()); params.set("perPage", String(pageSize)); }
      const res = await fetch(`/api/admin/leads?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads);
        setTotal(data.total);
        setCounts(data.counts || {});
        setPageByCol({}); // reset column pages on any refetch
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [buildParams, currentPage, view, pageSize]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Map view fetches points grouped by zip (respects the active filters).
  const fetchMap = useCallback(async () => {
    setMapLoading(true);
    try {
      const p = buildParams();
      if (convertedOnly) p.set("status", "CONVERTED"); // map-only quick filter, overrides the dropdown
      const res = await fetch(`/api/admin/leads/map?${p}`);
      if (res.ok) {
        const data = await res.json();
        setMapPoints(data.points || []);
        setMapMeta({ configured: data.configured, totalLeads: data.totalLeads, mappedLeads: data.mappedLeads, noZip: data.noZip, ungeocoded: data.ungeocoded });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMapLoading(false);
    }
  }, [buildParams, convertedOnly]);

  useEffect(() => { if (view === "map") fetchMap(); }, [view, fetchMap]);

  function saveColumns(cols: KanbanColumn[]) {
    setColumns(cols);
    localStorage.setItem(LS_COLUMNS, JSON.stringify(cols));
  }
  function saveAssignments(assigns: Record<string, string>) {
    setAssignments(assigns);
    localStorage.setItem(LS_ASSIGNMENTS, JSON.stringify(assigns));
  }

  // Ensure at least `needed` leads of a status are loaded (for deeper pages).
  async function ensureLoadedForStatus(status: LeadStatus, needed: number) {
    const loaded = leads.filter((l) => l.status === status).length;
    const target = Math.min(needed, counts[status] ?? 0);
    if (loaded >= target) return;
    setLoadingMore(status);
    try {
      const p = buildParams();
      p.set("view", "kanban");
      p.set("loadStatus", status);
      p.set("offset", String(loaded));
      p.set("limit", String(Math.max(target - loaded, 20)));
      const res = await fetch(`/api/admin/leads?${p}`);
      if (res.ok) {
        const data = await res.json();
        setLeads((prev) => {
          const seen = new Set(prev.map(leadKey));
          const add = ((data.leads as CombinedLead[]) || []).filter((l) => !seen.has(leadKey(l)));
          return [...prev, ...add];
        });
      }
    } finally {
      setLoadingMore(null);
    }
  }

  async function setColPage(col: KanbanColumn, p: number) {
    const target = Math.max(0, p);
    if (col.statusMapping) await ensureLoadedForStatus(col.statusMapping, (target + 1) * PER_PAGE);
    setPageByCol((prev) => ({ ...prev, [col.id]: target }));
  }

  async function moveLead(lead: CombinedLead, targetColId: string) {
    const col = columns.find((c) => c.id === targetColId);
    const newAssign = { ...assignments };
    if (col?.statusMapping) delete newAssign[leadKey(lead)];
    else newAssign[leadKey(lead)] = targetColId;
    saveAssignments(newAssign);

    if (col?.statusMapping && col.statusMapping !== lead.status) {
      const prevStatus = lead.status;
      const newStatus = col.statusMapping;
      const leadType = lead.type === "quote" ? "quote" : lead.type === "instagram" ? "instagram" : lead.type === "canvasser" ? "canvasser" : "adlead";
      await fetch("/api/admin/update-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, leadType, status: newStatus }),
      });
      setLeads((prev) => prev.map((l) => (l.id === lead.id && l.type === lead.type ? { ...l, status: newStatus } : l)));
      setCounts((c) => ({
        ...c,
        [prevStatus]: Math.max(0, (c[prevStatus] || 0) - 1),
        [newStatus]: (c[newStatus] || 0) + 1,
      }));
    }
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────
  function toggleSelect(key: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }
  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function bulkAction(action: "archive" | "status" | "grade", opts: { status?: LeadStatus; grade?: string | null } = {}) {
    const items = leads.filter((l) => selected.has(leadKey(l)));
    if (items.length === 0) return;
    const res = await fetch("/api/admin/leads/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, leads: items.map((l) => ({ type: l.type, id: l.id })), ...opts }),
    });
    if (!res.ok) return;
    const keys = new Set(selected);

    if (action === "archive") {
      const dec: Record<string, number> = {};
      for (const l of items) dec[l.status] = (dec[l.status] || 0) + 1;
      setLeads((prev) => prev.filter((l) => !keys.has(leadKey(l))));
      setCounts((c) => { const n = { ...c }; for (const s in dec) n[s] = Math.max(0, (n[s] || 0) - dec[s]); return n; });
    } else if (action === "status" && opts.status) {
      const newStatus = opts.status;
      const moved = items.filter((l) => l.status !== newStatus);
      const dec: Record<string, number> = {};
      for (const l of moved) dec[l.status] = (dec[l.status] || 0) + 1;
      setLeads((prev) => prev.map((l) => (keys.has(leadKey(l)) ? { ...l, status: newStatus } : l)));
      setCounts((c) => {
        const n = { ...c };
        for (const s in dec) n[s] = Math.max(0, (n[s] || 0) - dec[s]);
        n[newStatus] = (n[newStatus] || 0) + moved.length;
        return n;
      });
      const na = { ...assignments };
      for (const l of items) delete na[leadKey(l)];
      saveAssignments(na);
    } else if (action === "grade") {
      const grade = opts.grade ?? null;
      setLeads((prev) => prev.map((l) => (keys.has(leadKey(l)) ? { ...l, grade } : l)));
    }
    setSelected(new Set());
  }

  function handleAddColumn() {
    if (!newColName.trim()) return;
    saveColumns([...columns, { id: `custom_${Date.now()}`, name: newColName.trim(), color: newColColor }]);
    setNewColName("");
    setAddingCol(false);
  }
  function removeColumn(id: string) { saveColumns(columns.filter((c) => c.id !== id)); setOpenColMenu(null); }
  function startRename(col: KanbanColumn) { setEditingColId(col.id); setEditColName(col.name); setOpenColMenu(null); }
  function saveRename(id: string) {
    if (!editColName.trim()) return;
    saveColumns(columns.map((c) => (c.id === id ? { ...c, name: editColName.trim() } : c)));
    setEditingColId(null);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchValue) params.set("search", searchValue);
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    if (sourceFilter && sourceFilter !== "all") params.set("source", sourceFilter);
    router.push(`/admin/leads?${params}`);
  }

  const totalPages = Math.ceil(total / pageSize);

  // Group leads into columns for kanban
  const columnLeads = columns.reduce<Record<string, CombinedLead[]>>((acc, col) => {
    acc[col.id] = leads.filter((l) => getLeadColumnId(l, assignments, columns) === col.id);
    return acc;
  }, {});

  const detailHref = (lead: CombinedLead) =>
    `/admin/${lead.type === "quote" ? "quote-leads" : lead.type === "instagram" ? "instagram-leads" : lead.type === "canvasser" ? "canvasser-leads" : "ad-leads"}/${lead.id}`;

  return (
    <div className="space-y-3.5 pb-24 lg:pb-6">
      {/* Header — dark hero */}
      <div className="dgs-hero p-[22px] sm:p-[26px]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[30px] font-extrabold text-white tracking-[-0.03em] leading-none">Leads</h1>
            <p className="text-[12.5px] text-[#9C9CB0] mt-2">
              Pipeline · {(view === "map" ? mapMeta?.totalLeads ?? total : total)} total lead{(view === "map" ? mapMeta?.totalLeads ?? total : total) === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {view === "kanban" && (
              <button
                onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[12px] text-[13px] font-semibold transition-colors ${
                  selectMode ? "bg-white text-ink" : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                <span className="hidden sm:inline">{selectMode ? "Done" : "Select"}</span>
              </button>
            )}
            <div className="flex items-center bg-white/10 rounded-[12px] p-1">
              {([
                { v: "list" as const, icon: LayoutList, label: "List" },
                { v: "kanban" as const, icon: LayoutGrid, label: "Board" },
                { v: "map" as const, icon: MapIcon, label: "Map" },
              ]).map(({ v, icon: Icon, label }) => (
                <button
                  key={v}
                  onClick={() => selectView(v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[13px] font-semibold transition-colors ${
                    view === v ? "bg-white text-ink shadow-sm" : "text-white/70 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            <Link
              href="/admin/quote-leads/new"
              className="flex items-center gap-1.5 px-4 py-2 rounded-[12px] text-[13px] font-bold text-white transition-colors"
              style={{ background: "#8B6BFF" }}
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Add lead</span>
            </Link>
          </div>
        </div>
      </div>

      <CallIntelCard />

      {/* Filters */}
      <div className="dgs-card p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search by name, email, phone..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm appearance-none bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="PHONE_REVIEW">Phone Review</option>
              <option value="NEW">New</option>
              <option value="CONTACTED">Contacted</option>
              <option value="NO_ANSWER">No Answer</option>
              <option value="WAITING_FOR_SIGNUP">Quoted</option>
              <option value="CONVERTED">Won</option>
              <option value="NOT_INTERESTED">Lost</option>
            </select>
          </div>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm appearance-none bg-white"
          >
            <option value="all">All Sources</option>
            <option value="quote">Quote Form</option>
            <option value="ad">Meta Ads</option>
            <option value="instagram">Instagram</option>
            <option value="canvasser">Canvasser</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => changeSort(e.target.value as "newest" | "grade")}
            title="Sort order"
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm appearance-none bg-white"
          >
            <option value="newest">Newest first</option>
            <option value="grade">Priority (A→F)</option>
          </select>
          <select
            value={windowDays}
            onChange={(e) => changeWindow(parseInt(e.target.value))}
            title="Date window"
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm appearance-none bg-white"
          >
            <option value={0}>All time</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button type="submit" className="px-4 py-2 rounded-lg text-white text-sm font-semibold transition-colors" style={{ background: "#8B6BFF" }}>
            Apply
          </button>
        </form>
      </div>

      {/* Content */}
      {view === "map" ? (
        /* ── MAP VIEW ───────────────────────────────────────────────────── */
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              <span><b className="text-navy-900">{mapMeta?.mappedLeads ?? 0}</b> {convertedOnly ? "converted " : ""}leads mapped across <b className="text-navy-900">{mapPoints.length}</b> zip code{mapPoints.length === 1 ? "" : "s"}</span>
              {mapMeta && mapMeta.noZip > 0 && <span>· {mapMeta.noZip} without a zip code</span>}
              {mapMeta && mapMeta.ungeocoded > 0 && <span>· {mapMeta.ungeocoded} in a zip we couldn&apos;t locate</span>}
              {mapLoading && <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> refreshing…</span>}
            </div>
            <button
              onClick={() => setConvertedOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                convertedOnly ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-navy-900 hover:bg-gray-50"
              }`}
              title="Show only converted (Won) leads"
            >
              <CheckCircle2 className="w-4 h-4" />
              Converted only
            </button>
          </div>
          <LeadsMap points={mapPoints} token={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} />
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      ) : view === "list" ? (
        /* ── LIST VIEW ──────────────────────────────────────────────────── */
        <div className="dgs-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#FAFAFC] border-b border-hairline">
                <tr>
                  {["Name", "Contact", "Source", "Grade", "Status", "Date"].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No leads found</td></tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={leadKey(lead)} onClick={() => router.push(detailHref(lead))} className="hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-6 py-4">
                        <div className="font-medium text-navy-900">{lead.name}</div>
                        {lead.zipCode && <div className="text-xs text-gray-500">{lead.zipCode}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-navy-900">{lead.phone || "—"}</div>
                        {lead.email && <div className="text-xs text-gray-500">{lead.email}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${typeBadgeClass(lead.type)}`}>
                          <TypeIcon type={lead.type} />
                          {lead.source}
                        </span>
                      </td>
                      <td className="px-6 py-4"><GradeBadge grade={lead.grade} /></td>
                      <td className="px-6 py-4"><StatusBadge status={lead.status} /></td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(lead.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {total > 0 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-gray-500">
                Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} of {total}
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-sm text-gray-500">
                  <span className="hidden sm:inline">Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => changePageSize(parseInt(e.target.value))}
                    title="Leads per page"
                    className="px-2 py-1 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm appearance-none bg-white"
                  >
                    {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
                  </select>
                </label>
                {currentPage > 1 && (
                  <Link href={`/admin/leads?page=${currentPage - 1}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}${sourceFilter !== "all" ? `&source=${sourceFilter}` : ""}${searchValue ? `&search=${searchValue}` : ""}`} className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">Previous</Link>
                )}
                {currentPage < totalPages && (
                  <Link href={`/admin/leads?page=${currentPage + 1}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}${sourceFilter !== "all" ? `&source=${sourceFilter}` : ""}${searchValue ? `&search=${searchValue}` : ""}`} className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">Next</Link>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── KANBAN VIEW ────────────────────────────────────────────────── */
        <>
          <p className="text-xs text-gray-400 -mt-3">
            {selectMode
              ? "Tap cards to select, then act on them below."
              : "Drag a card to another column to update its status. Use the dots to page through each column."}
          </p>
          <div className="overflow-x-auto pb-4 -mx-4 px-4">
            <div className="flex gap-4 items-start" style={{ minWidth: `${(columns.length + 1) * 272}px` }}>
              {columns.map((col) => {
                const colLeads = columnLeads[col.id] ?? [];
                const c = COLUMN_COLORS[col.color];
                const totalItems = col.statusMapping ? (counts[col.statusMapping] ?? colLeads.length) : colLeads.length;
                const totalPagesCol = Math.max(1, Math.ceil(totalItems / PER_PAGE));
                const page = Math.min(pageByCol[col.id] ?? 0, totalPagesCol - 1);
                const visible = colLeads.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
                return (
                  <div key={col.id} className="flex-shrink-0 w-64">
                    {/* Column header */}
                    <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${c.header} border-x border-t ${c.border}`}>
                      {editingColId === col.id ? (
                        <form onSubmit={(e) => { e.preventDefault(); saveRename(col.id); }} className="flex-1 mr-2">
                          <input autoFocus value={editColName} onChange={(e) => setEditColName(e.target.value)} onBlur={() => saveRename(col.id)} className="w-full text-sm font-semibold bg-white border border-gray-200 rounded px-2 py-0.5 focus:ring-1 focus:ring-teal-500" />
                        </form>
                      ) : (
                        <span className={`text-sm font-semibold ${c.text} truncate`}>{col.name}</span>
                      )}
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full bg-white/70 ${c.text}`}>{totalItems}</span>
                        <div className="relative">
                          <button onClick={() => setOpenColMenu(openColMenu === col.id ? null : col.id)} className={`p-0.5 rounded hover:bg-white/50 ${c.text}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {openColMenu === col.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-36 py-1">
                              <button onClick={() => startRename(col)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Rename</button>
                              <button onClick={() => removeColumn(col.id)} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">Remove Column</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Cards (drop zone) */}
                    <div
                      onDragOver={(e) => { if (selectMode) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverCol !== col.id) setDragOverCol(col.id); }}
                      onDrop={(e) => { if (selectMode) return; e.preventDefault(); const dropped = leads.find((l) => leadKey(l) === draggedKey); if (dropped) moveLead(dropped, col.id); setDraggedKey(null); setDragOverCol(null); }}
                      className={`border-x border-b ${c.border} rounded-b-xl p-2 space-y-2 ${c.bg} transition-all ${dragOverCol === col.id ? "ring-2 ring-inset ring-teal-400" : ""}`}
                      style={{ minHeight: "13rem" }}
                    >
                      {visible.length === 0 && (
                        <div className="flex items-center justify-center h-20 text-xs text-gray-400">
                          {dragOverCol === col.id ? "Drop here" : "No leads"}
                        </div>
                      )}
                      {visible.map((lead) => {
                        const isSelected = selected.has(leadKey(lead));
                        return (
                          <div
                            key={leadKey(lead)}
                            draggable={!selectMode}
                            onDragStart={(e) => { if (selectMode) return; setDraggedKey(leadKey(lead)); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", leadKey(lead)); }}
                            onDragEnd={() => { setDraggedKey(null); setDragOverCol(null); }}
                            onClick={() => { if (selectMode) toggleSelect(leadKey(lead)); }}
                            className={`bg-white rounded-lg border shadow-sm p-3 transition-all ${
                              selectMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
                            } ${isSelected ? "border-teal-500 ring-2 ring-teal-400" : "border-gray-200"} ${draggedKey === leadKey(lead) ? "opacity-40" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-navy-900 truncate">{lead.name}</p>
                                {lead.phone && <p className="text-xs text-gray-500 mt-0.5">{lead.phone}</p>}
                              </div>
                              {selectMode ? (
                                isSelected
                                  ? <CheckCircle2 className="w-5 h-5 text-teal-600 flex-shrink-0" />
                                  : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                              ) : (
                                <Link href={detailHref(lead)} onClick={(e) => e.stopPropagation()} className="p-1 rounded hover:bg-gray-100 transition-colors flex-shrink-0" title="View details">
                                  <MoreHorizontal className="w-4 h-4 text-gray-400" />
                                </Link>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded-full ${typeBadgeClass(lead.type)}`}>
                                <TypeIcon type={lead.type} />
                                {typeShortLabel(lead.type)}
                              </span>
                              <GradeBadge grade={lead.grade} />
                              <span className="text-xs text-gray-400 ml-auto">{timeAgo(lead.createdAt)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Page dots */}
                    {totalPagesCol > 1 && (
                      <div className="flex items-center justify-center gap-1.5 mt-2">
                        <button
                          onClick={() => setColPage(col, page - 1)}
                          disabled={page === 0 || loadingMore === col.statusMapping}
                          className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30"
                          aria-label="Previous page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        {loadingMore === col.statusMapping ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-500" />
                        ) : (
                          pageDots(page, totalPagesCol).map((d) => (
                            <button
                              key={d}
                              onClick={() => setColPage(col, d)}
                              aria-label={`Page ${d + 1}`}
                              className={`rounded-full transition-all ${d === page ? "w-2.5 h-2.5 bg-teal-600" : "w-2 h-2 bg-gray-300 hover:bg-gray-400"}`}
                            />
                          ))
                        )}
                        <button
                          onClick={() => setColPage(col, page + 1)}
                          disabled={page >= totalPagesCol - 1 || loadingMore === col.statusMapping}
                          className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30"
                          aria-label="Next page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <span className="text-[10px] text-gray-400 ml-1 tabular-nums">{page + 1}/{totalPagesCol}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add column */}
              <div className="flex-shrink-0 w-64">
                {addingCol ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                    <input autoFocus value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="Column name..." className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500" onKeyDown={(e) => { if (e.key === "Enter") handleAddColumn(); if (e.key === "Escape") setAddingCol(false); }} />
                    <div className="flex flex-wrap gap-1.5">
                      {COLOR_OPTIONS.map((color) => (
                        <button key={color} onClick={() => setNewColColor(color)} title={color} className={`w-6 h-6 rounded-full ${COLUMN_COLORS[color].header} border-2 transition-transform ${newColColor === color ? "border-gray-600 scale-125" : "border-transparent"}`} />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleAddColumn} className="flex-1 px-3 py-1.5 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 font-medium">Add</button>
                      <button onClick={() => { setAddingCol(false); setNewColName(""); }} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAddingCol(true)} className="w-full flex items-center gap-2 px-3 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-teal-400 hover:text-teal-600 transition-colors">
                    <Plus className="w-4 h-4" />
                    Add Column
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bulk action bar */}
      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-navy-900 text-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 flex-wrap justify-center max-w-[95vw]">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="h-5 w-px bg-white/20" />
          <select
            value=""
            onChange={(e) => { if (e.target.value) bulkAction("status", { status: e.target.value as LeadStatus }); }}
            className="bg-white/10 text-white text-sm rounded-lg px-2 py-1.5 border border-white/20 focus:ring-2 focus:ring-teal-400"
          >
            <option value="" className="text-gray-900">Move to…</option>
            <option value="PHONE_REVIEW" className="text-gray-900">Phone Review</option>
            <option value="NEW" className="text-gray-900">New</option>
            <option value="CONTACTED" className="text-gray-900">Contacted</option>
            <option value="NO_ANSWER" className="text-gray-900">No Answer</option>
            <option value="WAITING_FOR_SIGNUP" className="text-gray-900">Quoted</option>
            <option value="CONVERTED" className="text-gray-900">Won</option>
            <option value="NOT_INTERESTED" className="text-gray-900">Lost</option>
          </select>
          <select
            value=""
            onChange={(e) => { if (e.target.value) bulkAction("grade", { grade: e.target.value === "none" ? null : e.target.value }); }}
            className="bg-white/10 text-white text-sm rounded-lg px-2 py-1.5 border border-white/20 focus:ring-2 focus:ring-teal-400"
          >
            <option value="" className="text-gray-900">Grade…</option>
            {["A", "B", "C", "D", "F"].map((g) => <option key={g} value={g} className="text-gray-900">{g}</option>)}
            <option value="none" className="text-gray-900">Clear grade</option>
          </select>
          <button onClick={() => bulkAction("archive")} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium border border-white/20">
            <Archive className="w-4 h-4" />
            Archive
          </button>
          <button onClick={exitSelect} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Cancel selection">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Overlay to close column menus */}
      {openColMenu && <div className="fixed inset-0 z-10" onClick={() => setOpenColMenu(null)} />}
    </div>
  );
}
