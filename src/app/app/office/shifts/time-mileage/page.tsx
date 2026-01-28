"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertCircle,
  AlertTriangle,
  Download,
} from "lucide-react";
import Link from "next/link";

interface StaffMember {
  id: string;
  name: string;
}

interface StaffTimeMileage {
  userId: string;
  name: string;
  totalTimeMinutes: number;
  totalTimeFormatted: string;
  personalMileage: number;
  companyMileage: number;
  totalMileage: number;
  hasIncompleteShifts: boolean;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function TimeMileageReportPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<StaffTimeMileage[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedStaff) params.set("userId", selectedStaff);
      if (fromDate) params.set("startDate", fromDate);
      if (toDate) params.set("endDate", toDate);

      const res = await fetch(`/api/admin/shifts/time-mileage?${params}`);
      const data = await res.json();

      if (res.ok) {
        setReport(data.report || []);
        setStaffList(data.staff || []);
      } else {
        setError(data.error || "Failed to load report");
      }
    } catch (err) {
      console.error("Error fetching report:", err);
      setError("Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [selectedStaff, fromDate, toDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleGo = () => {
    setPage(1);
    fetchReport();
  };

  const resetFilters = () => {
    setSelectedStaff("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const exportCsv = () => {
    if (report.length === 0) return;

    const headers = ["Name", "Time", "Personal mileage(mi)", "Company mileage(mi)", "Total mileage(mi)"];
    const rows = report.map((r) => [
      r.name,
      r.totalTimeFormatted,
      r.personalMileage.toString(),
      r.companyMileage.toString(),
      r.totalMileage.toString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `time-mileage-report-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pagination
  const totalItems = report.length;
  const totalPages = Math.ceil(totalItems / limit);
  const paginatedReport = report.slice((page - 1) * limit, page * limit);
  const startItem = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, totalItems);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Time & Mileage Report</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={loading || report.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Staff Dropdown */}
          <div>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-w-[200px]"
            >
              <option value="">Staff</option>
              {staffList.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                </option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Calendar className="w-4 h-4" />
            </div>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              placeholder="From Date"
              className="pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-w-[180px]"
            />
          </div>

          {/* End Date */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Calendar className="w-4 h-4" />
            </div>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              placeholder="End Date"
              className="pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-w-[180px]"
            />
          </div>

          {/* GO Button */}
          <button
            onClick={handleGo}
            disabled={loading}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium"
          >
            GO
          </button>
        </div>

        {/* Reset Filters */}
        <div className="mt-3">
          <button
            onClick={resetFilters}
            className="text-teal-600 hover:text-teal-700 text-sm font-medium"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Time
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Personal mileage(mi)
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Company mileage(mi)
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Total mileage(mi)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
                  </td>
                </tr>
              ) : paginatedReport.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    No data results in data table
                  </td>
                </tr>
              ) : (
                paginatedReport.map((staff) => (
                  <tr key={staff.userId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        {staff.hasIncompleteShifts && (
                          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        )}
                        <Link
                          href={`/app/office/staff/${staff.userId}`}
                          className="text-teal-600 hover:text-teal-700 hover:underline"
                        >
                          {staff.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {staff.totalTimeFormatted}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {staff.personalMileage}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {staff.companyMileage}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {staff.totalMileage}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Items per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 border border-gray-200 rounded text-sm"
            >
              {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {startItem}-{endItem} of {totalItems}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50 disabled:hover:bg-transparent"
                title="First page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50 disabled:hover:bg-transparent"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50 disabled:hover:bg-transparent"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages || totalPages === 0}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50 disabled:hover:bg-transparent"
                title="Last page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
