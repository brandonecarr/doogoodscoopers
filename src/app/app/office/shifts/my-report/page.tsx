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
} from "lucide-react";

interface Shift {
  id: string;
  shiftDate: string;
  clockIn: string | null;
  clockOut: string | null;
  startOdometer: number | null;
  endOdometer: number | null;
  vehicleType: string | null;
  status: string;
  notes: string | null;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function MyShiftReportPage() {
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("myShifts", "true");
      if (fromDate) params.set("startDate", fromDate);
      if (toDate) params.set("endDate", toDate);

      const res = await fetch(`/api/admin/shifts?${params}`);
      const data = await res.json();

      if (res.ok) {
        // Format shifts from API response
        const formattedShifts = (data.shifts || []).map((shift: {
          id: string;
          shift_date: string;
          clock_in: string | null;
          clock_out: string | null;
          start_odometer: number | null;
          end_odometer: number | null;
          vehicle_type: string | null;
          status: string;
          notes: string | null;
        }) => ({
          id: shift.id,
          shiftDate: shift.shift_date,
          clockIn: shift.clock_in,
          clockOut: shift.clock_out,
          startOdometer: shift.start_odometer,
          endOdometer: shift.end_odometer,
          vehicleType: shift.vehicle_type,
          status: shift.status,
          notes: shift.notes,
        }));
        setShifts(formattedShifts);
      } else {
        setError(data.error || "Failed to load shifts");
      }
    } catch (err) {
      console.error("Error fetching shifts:", err);
      setError("Failed to load shifts");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const handleGo = () => {
    setPage(1);
    fetchShifts();
  };

  const resetFilters = () => {
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateTimeString: string | null) => {
    if (!dateTimeString) return "-";
    return new Date(dateTimeString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculateDuration = (clockIn: string | null, clockOut: string | null) => {
    if (!clockIn || !clockOut) return "-";
    const start = new Date(clockIn).getTime();
    const end = new Date(clockOut).getTime();
    const diffMs = end - start;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const calculateDistance = (startOdometer: number | null, endOdometer: number | null) => {
    if (startOdometer === null || endOdometer === null) return "-";
    const distance = endOdometer - startOdometer;
    return `${distance.toFixed(1)} mi`;
  };

  // Pagination
  const totalItems = shifts.length;
  const totalPages = Math.ceil(totalItems / limit);
  const paginatedShifts = shifts.slice((page - 1) * limit, page * limit);
  const startItem = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, totalItems);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Shift Report</h1>
        </div>
        <button
          onClick={fetchShifts}
          disabled={loading}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
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

          {/* To Date */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Calendar className="w-4 h-4" />
            </div>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              placeholder="To Date"
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
                  Shift Id
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Start Date
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Start time
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  End time
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Shift duration
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Distance
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Company vehicle
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
                  </td>
                </tr>
              ) : paginatedShifts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    No data results in data table
                  </td>
                </tr>
              ) : (
                paginatedShifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                      {shift.id.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatDate(shift.shiftDate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatTime(shift.clockIn)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatTime(shift.clockOut)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {calculateDuration(shift.clockIn, shift.clockOut)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {calculateDistance(shift.startOdometer, shift.endOdometer)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {shift.vehicleType || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">
                      {shift.notes || "-"}
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
