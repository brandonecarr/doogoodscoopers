"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Filter,
  Loader2,
  LayoutList,
  LayoutGrid,
  Plus,
  MoreHorizontal,
  FileText,
  Megaphone,
} from "lucide-react";
import type { LeadStatus } from "@/types/leads";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CombinedLead {
  id: string;
  type: "quote" | "ad";
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

type ColorKey =
  | "teal"
  | "blue"
  | "orange"
  | "gray"
  | "purple"
  | "green"
  | "red"
  | "yellow"
  | "pink"
  | "indigo";

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

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "new",            name: "New",               color: "teal",   statusMapping: "NEW" },
  { id: "contacted",      name: "Contacted",          color: "blue",   statusMapping: "CONTACTED" },
  { id: "no_answer",      name: "No Answer",          color: "orange", statusMapping: "NO_ANSWER" },
  { id: "not_interested", name: "Not Interested",     color: "gray",   statusMapping: "NOT_INTERESTED" },
  { id: "waiting",        name: "Waiting for Signup", color: "purple", statusMapping: "WAITING_FOR_SIGNUP" },
  { id: "converted",      name: "Converted",          color: "green",  statusMapping: "CONVERTED" },
];

const LS_COLUMNS     = "dgs_kanban_columns";
const LS_ASSIGNMENTS = "dgs_kanban_assignments";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function leadKey(lead: CombinedLead) {
  return `${lead.type}:${lead.id}`;
}

function getLeadColumnId(
  lead: CombinedLead,
  assignments: Record<string, string>,
  columns: KanbanColumn[]
): string {
  const assigned = assignments[leadKey(lead)];
  if (assigned && columns.find((c) => c.id === assigned)) return assigned;
  const byStatus = columns.find((c) => c.statusMapping === lead.status);
  if (byStatus) return byStatus.id;
  return columns[0]?.id ?? "";
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
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: LeadStatus }) {
  const styles: Record<LeadStatus, string> = {
    NEW:                "bg-teal-100 text-teal-800",
    CONTACTED:          "bg-blue-100 text-blue-800",
    NO_ANSWER:          "bg-orange-100 text-orange-800",
    NOT_INTERESTED:     "bg-gray-100 text-gray-800",
    WAITING_FOR_SIGNUP: "bg-purple-100 text-purple-800",
    CONVERTED:          "bg-green-100 text-green-800",
  };
  const labels: Record<LeadStatus, string> = {
    NEW:                "New",
    CONTACTED:          "Contacted",
    NO_ANSWER:          "No Answer",
    NOT_INTERESTED:     "Not Interested",
    WAITING_FOR_SIGNUP: "Waiting for Signup",
    CONVERTED:          "Converted",
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function GradeBadge({ grade }: { grade: string | null | undefined }) {
  if (!grade) return null;
  const styles: Record<string, string> = {
    A: "bg-green-100 text-green-800",
    B: "bg-teal-100 text-teal-800",
    C: "bg-yellow-100 text-yellow-800",
    D: "bg-orange-100 text-orange-800",
    F: "bg-red-100 text-red-800",
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-bold rounded ${styles[grade] ?? "bg-gray-100 text-gray-800"}`}>
      {grade}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LeadsPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [leads,        setLeads]        = useState<CombinedLead[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [view,         setView]         = useState<"list" | "kanban">("list");
  const [searchValue,  setSearchValue]  = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [sourceFilter, setSourceFilter] = useState(searchParams.get("source") || "all");

  // Kanban state
  const [columns,      setColumns]      = useState<KanbanColumn[]>(DEFAULT_COLUMNS);
  const [assignments,  setAssignments]  = useState<Record<string, string>>({});
  const [addingCol,    setAddingCol]    = useState(false);
  const [newColName,   setNewColName]   = useState("");
  const [newColColor,  setNewColColor]  = useState<ColorKey>("blue");
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editColName,  setEditColName]  = useState("");
  const [openCardMenu, setOpenCardMenu] = useState<string | null>(null);
  const [openColMenu,  setOpenColMenu]  = useState<string | null>(null);

  const currentPage = parseInt(searchParams.get("page") || "1");
  const pageSize    = 20;

  // Load kanban config from localStorage
  useEffect(() => {
    try {
      const storedCols = localStorage.getItem(LS_COLUMNS);
      if (storedCols) {
        const parsed = JSON.parse(storedCols) as KanbanColumn[];
        if (Array.isArray(parsed) && parsed.length > 0) setColumns(parsed);
      }
      const storedAssign = localStorage.getItem(LS_ASSIGNMENTS);
      if (storedAssign) setAssignments(JSON.parse(storedAssign));
    } catch {}
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (sourceFilter && sourceFilter !== "all") params.set("source", sourceFilter);
      if (searchValue) params.set("search", searchValue);
      if (view === "kanban") {
        params.set("view", "kanban");
      } else {
        params.set("page", currentPage.toString());
      }
      const res = await fetch(`/api/admin/leads?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads);
        setTotal(data.total);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sourceFilter, searchValue, currentPage, view]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  function saveColumns(cols: KanbanColumn[]) {
    setColumns(cols);
    localStorage.setItem(LS_COLUMNS, JSON.stringify(cols));
  }

  function saveAssignments(assigns: Record<string, string>) {
    setAssignments(assigns);
    localStorage.setItem(LS_ASSIGNMENTS, JSON.stringify(assigns));
  }

  async function moveLead(lead: CombinedLead, targetColId: string) {
    const newAssign = { ...assignments, [leadKey(lead)]: targetColId };
    saveAssignments(newAssign);

    const col = columns.find((c) => c.id === targetColId);
    if (col?.statusMapping && col.statusMapping !== lead.status) {
      const leadType = lead.type === "quote" ? "quote" : "adlead";
      await fetch("/api/admin/update-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, leadType, status: col.statusMapping }),
      });
      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id && l.type === lead.type
            ? { ...l, status: col.statusMapping! }
            : l
        )
      );
    }
    setOpenCardMenu(null);
  }

  function handleAddColumn() {
    if (!newColName.trim()) return;
    const newCol: KanbanColumn = {
      id: `custom_${Date.now()}`,
      name: newColName.trim(),
      color: newColColor,
    };
    saveColumns([...columns, newCol]);
    setNewColName("");
    setAddingCol(false);
  }

  function removeColumn(id: string) {
    saveColumns(columns.filter((c) => c.id !== id));
    setOpenColMenu(null);
  }

  function startRename(col: KanbanColumn) {
    setEditingColId(col.id);
    setEditColName(col.name);
    setOpenColMenu(null);
  }

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
    `/admin/${lead.type === "quote" ? "quote-leads" : "ad-leads"}/${lead.id}`;

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Leads</h1>
          <p className="text-navy-600 mt-1">{total} total leads</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === "list"
                  ? "bg-white text-navy-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <LayoutList className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setView("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === "kanban"
                  ? "bg-white text-navy-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Board</span>
            </button>
          </div>

          <Link
            href="/admin/quote-leads/new"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            <span>Add Lead</span>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
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
              <option value="NEW">New</option>
              <option value="CONTACTED">Contacted</option>
              <option value="NO_ANSWER">No Answer</option>
              <option value="NOT_INTERESTED">Not Interested</option>
              <option value="WAITING_FOR_SIGNUP">Waiting for Signup</option>
              <option value="CONVERTED">Converted</option>
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
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm"
          >
            Apply
          </button>
        </form>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      ) : view === "list" ? (
        /* ── LIST VIEW ──────────────────────────────────────────────────── */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No leads found
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr
                      key={leadKey(lead)}
                      onClick={() => router.push(detailHref(lead))}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-navy-900">{lead.name}</div>
                        {lead.zipCode && (
                          <div className="text-xs text-gray-500">{lead.zipCode}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-navy-900">{lead.phone || "—"}</div>
                        {lead.email && (
                          <div className="text-xs text-gray-500">{lead.email}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                            lead.type === "quote"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-pink-100 text-pink-800"
                          }`}
                        >
                          {lead.type === "quote" ? (
                            <FileText className="w-3 h-3" />
                          ) : (
                            <Megaphone className="w-3 h-3" />
                          )}
                          {lead.source}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <GradeBadge grade={lead.grade} />
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(lead.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, total)} of {total}
              </div>
              <div className="flex gap-2">
                {currentPage > 1 && (
                  <Link
                    href={`/admin/leads?page=${currentPage - 1}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}${sourceFilter !== "all" ? `&source=${sourceFilter}` : ""}${searchValue ? `&search=${searchValue}` : ""}`}
                    className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    Previous
                  </Link>
                )}
                {currentPage < totalPages && (
                  <Link
                    href={`/admin/leads?page=${currentPage + 1}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}${sourceFilter !== "all" ? `&source=${sourceFilter}` : ""}${searchValue ? `&search=${searchValue}` : ""}`}
                    className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── KANBAN VIEW ────────────────────────────────────────────────── */
        <div className="overflow-x-auto pb-4 -mx-4 px-4">
          <div
            className="flex gap-4 items-start"
            style={{ minWidth: `${(columns.length + 1) * 272}px` }}
          >
            {columns.map((col) => {
              const colLeads = columnLeads[col.id] ?? [];
              const c = COLUMN_COLORS[col.color];
              return (
                <div key={col.id} className="flex-shrink-0 w-64">
                  {/* Column header */}
                  <div
                    className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${c.header} border-x border-t ${c.border}`}
                  >
                    {editingColId === col.id ? (
                      <form
                        onSubmit={(e) => { e.preventDefault(); saveRename(col.id); }}
                        className="flex-1 mr-2"
                      >
                        <input
                          autoFocus
                          value={editColName}
                          onChange={(e) => setEditColName(e.target.value)}
                          onBlur={() => saveRename(col.id)}
                          className="w-full text-sm font-semibold bg-white border border-gray-200 rounded px-2 py-0.5 focus:ring-1 focus:ring-teal-500"
                        />
                      </form>
                    ) : (
                      <span className={`text-sm font-semibold ${c.text} truncate`}>
                        {col.name}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <span
                        className={`text-xs font-medium px-1.5 py-0.5 rounded-full bg-white/70 ${c.text}`}
                      >
                        {colLeads.length}
                      </span>
                      <div className="relative">
                        <button
                          onClick={() =>
                            setOpenColMenu(openColMenu === col.id ? null : col.id)
                          }
                          className={`p-0.5 rounded hover:bg-white/50 ${c.text}`}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {openColMenu === col.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-36 py-1">
                            <button
                              onClick={() => startRename(col)}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              Rename
                            </button>
                            <button
                              onClick={() => removeColumn(col.id)}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              Remove Column
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cards */}
                  <div
                    className={`border-x border-b ${c.border} rounded-b-xl min-h-48 p-2 space-y-2 ${c.bg}`}
                  >
                    {colLeads.length === 0 && (
                      <div className="flex items-center justify-center h-20 text-xs text-gray-400">
                        No leads
                      </div>
                    )}
                    {colLeads.map((lead) => (
                      <div
                        key={leadKey(lead)}
                        className="bg-white rounded-lg border border-gray-200 shadow-sm p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-navy-900 truncate">
                              {lead.name}
                            </p>
                            {lead.phone && (
                              <p className="text-xs text-gray-500 mt-0.5">{lead.phone}</p>
                            )}
                          </div>
                          <div className="relative flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenCardMenu(
                                  openCardMenu === leadKey(lead) ? null : leadKey(lead)
                                );
                              }}
                              className="p-1 rounded hover:bg-gray-100 transition-colors"
                            >
                              <MoreHorizontal className="w-4 h-4 text-gray-400" />
                            </button>
                            {openCardMenu === leadKey(lead) && (
                              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-44 py-1">
                                <Link
                                  href={detailHref(lead)}
                                  className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                                >
                                  View Details
                                </Link>
                                <div className="px-3 pt-2 pb-1">
                                  <p className="text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">
                                    Move to
                                  </p>
                                  {columns
                                    .filter((c) => c.id !== col.id)
                                    .map((target) => (
                                      <button
                                        key={target.id}
                                        onClick={() => moveLead(lead, target.id)}
                                        className="w-full text-left px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded"
                                      >
                                        {target.name}
                                      </button>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded-full ${
                              lead.type === "quote"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-pink-100 text-pink-700"
                            }`}
                          >
                            {lead.type === "quote" ? (
                              <FileText className="w-3 h-3" />
                            ) : (
                              <Megaphone className="w-3 h-3" />
                            )}
                            {lead.type === "quote" ? "Quote" : "Ad"}
                          </span>
                          <GradeBadge grade={lead.grade} />
                          <span className="text-xs text-gray-400 ml-auto">
                            {timeAgo(lead.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Add column */}
            <div className="flex-shrink-0 w-64">
              {addingCol ? (
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <input
                    autoFocus
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    placeholder="Column name..."
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddColumn();
                      if (e.key === "Escape") setAddingCol(false);
                    }}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewColColor(color)}
                        title={color}
                        className={`w-6 h-6 rounded-full ${COLUMN_COLORS[color].header} border-2 transition-transform ${
                          newColColor === color
                            ? "border-gray-600 scale-125"
                            : "border-transparent"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddColumn}
                      className="flex-1 px-3 py-1.5 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 font-medium"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setAddingCol(false); setNewColName(""); }}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingCol(true)}
                  className="w-full flex items-center gap-2 px-3 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-teal-400 hover:text-teal-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Column
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Overlay to close menus */}
      {(openCardMenu || openColMenu) && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => { setOpenCardMenu(null); setOpenColMenu(null); }}
        />
      )}
    </div>
  );
}
