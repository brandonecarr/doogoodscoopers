"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileText, Search, Filter, Plus, Archive, Loader2 } from "lucide-react";
import type { LeadStatus, QuoteLead } from "@/types/leads";

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getStatusBadge(status: LeadStatus) {
  const styles: Record<LeadStatus, string> = {
    NEW: "bg-teal-100 text-teal-800",
    CONTACTED: "bg-blue-100 text-blue-800",
    QUALIFIED: "bg-purple-100 text-purple-800",
    CONVERTED: "bg-green-100 text-green-800",
    LOST: "bg-gray-100 text-gray-800",
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>
      {status}
    </span>
  );
}

function getGradeBadge(grade: string | null | undefined) {
  if (!grade) return null;

  const styles: Record<string, string> = {
    A: "bg-green-100 text-green-800",
    B: "bg-teal-100 text-teal-800",
    C: "bg-yellow-100 text-yellow-800",
    D: "bg-orange-100 text-orange-800",
    F: "bg-red-100 text-red-800",
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-bold rounded ${styles[grade] || "bg-gray-100"}`}>
      {grade}
    </span>
  );
}

interface LeadWithGrade extends QuoteLead {
  grade?: string | null;
  followupDate?: string | null;
}

export default function QuoteLeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<LeadWithGrade[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");

  const showArchived = searchParams.get("archived") === "true";
  const currentPage = parseInt(searchParams.get("page") || "1");
  const pageSize = 20;

  useEffect(() => {
    async function fetchLeads() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchParams.get("status") && searchParams.get("status") !== "all") {
          params.set("status", searchParams.get("status")!);
        }
        if (searchParams.get("search")) {
          params.set("search", searchParams.get("search")!);
        }
        params.set("page", currentPage.toString());
        params.set("archived", showArchived.toString());

        const response = await fetch(`/api/admin/quote-leads?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setLeads(data.leads);
          setTotal(data.total);
        }
      } catch (error) {
        console.error("Error fetching leads:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchLeads();
  }, [searchParams, currentPage, showArchived]);

  const totalPages = Math.ceil(total / pageSize);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchValue) params.set("search", searchValue);
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    if (showArchived) params.set("archived", "true");
    router.push(`/admin/quote-leads?${params.toString()}`);
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">
            {showArchived ? "Archived Leads" : "Quote Leads"}
          </h1>
          <p className="text-navy-600 mt-1">{total} {showArchived ? "archived" : "active"} leads</p>
        </div>
        <div className="flex items-center gap-3">
          {!showArchived && (
            <Link
              href="/admin/quote-leads/new"
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add New
            </Link>
          )}
          <Link
            href={showArchived ? "/admin/quote-leads" : "/admin/quote-leads?archived=true"}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showArchived
                ? "bg-teal-600 text-white hover:bg-teal-700"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Archive className="w-4 h-4" />
            {showArchived ? "View Active" : "View Archived"}
          </Link>
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search by name, email, phone, or zip..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="NEW">New</option>
              <option value="CONTACTED">Contacted</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="CONVERTED">Converted</option>
              <option value="LOST">Lost</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            Apply
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Step
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Grade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        No leads found
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => (
                      <tr
                        key={lead.id}
                        onClick={() => router.push(`/admin/quote-leads/${lead.id}`)}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <div className="font-medium text-navy-900">
                            {lead.firstName} {lead.lastName || ""}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-navy-900">{lead.phone}</div>
                          {lead.email && (
                            <div className="text-sm text-gray-500">{lead.email}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-navy-900">{lead.zipCode}</div>
                          {lead.city && (
                            <div className="text-sm text-gray-500">{lead.city}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">
                            {lead.lastStep || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {getGradeBadge(lead.grade)}
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(lead.status)}</td>
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
                  Showing {(currentPage - 1) * pageSize + 1} to{" "}
                  {Math.min(currentPage * pageSize, total)} of {total}
                </div>
                <div className="flex gap-2">
                  {currentPage > 1 && (
                    <Link
                      href={`/admin/quote-leads?page=${currentPage - 1}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}${searchValue ? `&search=${searchValue}` : ""}${showArchived ? "&archived=true" : ""}`}
                      className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      Previous
                    </Link>
                  )}
                  {currentPage < totalPages && (
                    <Link
                      href={`/admin/quote-leads?page=${currentPage + 1}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}${searchValue ? `&search=${searchValue}` : ""}${showArchived ? "&archived=true" : ""}`}
                      className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      Next
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
