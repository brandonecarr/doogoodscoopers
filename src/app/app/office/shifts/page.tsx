"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Clock,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Play,
  Square,
  Coffee,
  Download,
  Calendar,
  User,
  Timer,
  Car,
} from "lucide-react";
import { getRoleDisplayName, getRoleColor } from "@/lib/rbac";
import type { UserRole } from "@/lib/supabase/types";

interface ShiftBreak {
  id: string;
  break_start: string;
  break_end: string | null;
  break_type: string;
}

interface ShiftUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
}

interface Shift {
  id: string;
  user_id: string;
  route_id: string | null;
  shift_date: string;
  clock_in: string | null;
  clock_out: string | null;
  start_odometer: number | null;
  end_odometer: number | null;
  vehicle_type: string | null;
  status: "SCHEDULED" | "CLOCKED_IN" | "ON_BREAK" | "CLOCKED_OUT";
  notes: string | null;
  user: ShiftUser;
  route: { id: string; name: string | null; status: string } | null;
  breaks: ShiftBreak[];
}

interface StaffMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: UserRole;
}

export default function ShiftsPage() {
  const searchParams = useSearchParams();
  const initialStatus = useMemo(() => searchParams.get("status") || "", []);
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dateRange, setDateRange] = useState<"day" | "week" | "month">("day");
  const [staffFilter, setStaffFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchShifts();
    fetchStaff();
  }, [selectedDate, dateRange, staffFilter, statusFilter]);

  async function fetchShifts() {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (dateRange === "day") {
        params.set("date", selectedDate);
      } else if (dateRange === "week") {
        const start = new Date(selectedDate);
        start.setDate(start.getDate() - start.getDay()); // Start of week
        const end = new Date(start);
        end.setDate(end.getDate() + 6); // End of week
        params.set("startDate", start.toISOString().split("T")[0]);
        params.set("endDate", end.toISOString().split("T")[0]);
      } else if (dateRange === "month") {
        const start = new Date(selectedDate);
        start.setDate(1);
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        params.set("startDate", start.toISOString().split("T")[0]);
        params.set("endDate", end.toISOString().split("T")[0]);
      }

      if (staffFilter) params.set("userId", staffFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/shifts?${params}`);
      const data = await res.json();

      if (res.ok) {
        setShifts(data.shifts || []);
      }
    } catch (err) {
      console.error("Error fetching shifts:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStaff() {
    try {
      const res = await fetch("/api/admin/staff?status=active");
      const data = await res.json();
      if (res.ok) {
        setStaff(
          (data.staff || []).filter((s: StaffMember) =>
            ["FIELD_TECH", "CREW_LEAD", "MANAGER", "OWNER"].includes(s.role)
          )
        );
      }
    } catch (err) {
      console.error("Error fetching staff:", err);
    }
  }

  function navigateDate(direction: "prev" | "next") {
    const date = new Date(selectedDate);
    if (dateRange === "day") {
      date.setDate(date.getDate() + (direction === "next" ? 1 : -1));
    } else if (dateRange === "week") {
      date.setDate(date.getDate() + (direction === "next" ? 7 : -7));
    } else {
      date.setMonth(date.getMonth() + (direction === "next" ? 1 : -1));
    }
    setSelectedDate(date.toISOString().split("T")[0]);
  }

  function calculateDuration(shift: Shift): string {
    if (!shift.clock_in) return "-";
    const start = new Date(shift.clock_in);
    const end = shift.clock_out ? new Date(shift.clock_out) : new Date();

    // Subtract break time
    let breakMinutes = 0;
    for (const b of shift.breaks) {
      const breakStart = new Date(b.break_start);
      const breakEnd = b.break_end ? new Date(b.break_end) : new Date();
      breakMinutes += (breakEnd.getTime() - breakStart.getTime()) / 60000;
    }

    const totalMinutes = (end.getTime() - start.getTime()) / 60000 - breakMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);

    return `${hours}h ${mins}m`;
  }

  function calculateMileage(shift: Shift): string {
    if (!shift.start_odometer || !shift.end_odometer) return "-";
    return `${(shift.end_odometer - shift.start_odometer).toLocaleString()} mi`;
  }

  function getStatusBadge(status: Shift["status"]) {
    const styles = {
      SCHEDULED: "bg-gray-100 text-gray-700",
      CLOCKED_IN: "bg-green-100 text-green-700",
      ON_BREAK: "bg-amber-100 text-amber-700",
      CLOCKED_OUT: "bg-blue-100 text-blue-700",
    };
    const labels = {
      SCHEDULED: "Scheduled",
      CLOCKED_IN: "Clocked In",
      ON_BREAK: "On Break",
      CLOCKED_OUT: "Completed",
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  }

  function formatTime(dateStr: string | null): string {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function formatDateRange(): string {
    const date = new Date(selectedDate);
    if (dateRange === "day") {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } else if (dateRange === "week") {
      const start = new Date(date);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })} - ${end.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;
    } else {
      return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
  }

  async function exportTimesheet() {
    // Generate CSV
    const headers = [
      "Date",
      "Employee",
      "Role",
      "Clock In",
      "Clock Out",
      "Duration",
      "Breaks",
      "Start Odometer",
      "End Odometer",
      "Mileage",
      "Status",
    ];

    const rows = shifts.map((shift) => {
      const breakTime = shift.breaks.reduce((acc, b) => {
        const start = new Date(b.break_start);
        const end = b.break_end ? new Date(b.break_end) : new Date();
        return acc + (end.getTime() - start.getTime()) / 60000;
      }, 0);

      return [
        shift.shift_date,
        `${shift.user.first_name || ""} ${shift.user.last_name || ""}`.trim() ||
          shift.user.email,
        shift.user_id, // Would need role from user
        formatTime(shift.clock_in),
        formatTime(shift.clock_out),
        calculateDuration(shift),
        `${Math.round(breakTime)}m`,
        shift.start_odometer?.toString() || "",
        shift.end_odometer?.toString() || "",
        calculateMileage(shift),
        shift.status,
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesheet-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredShifts = shifts.filter((shift) => {
    if (!searchQuery) return true;
    const name =
      `${shift.user.first_name || ""} ${shift.user.last_name || ""}`.toLowerCase();
    return (
      name.includes(searchQuery.toLowerCase()) ||
      shift.user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Calculate summary stats
  const stats = {
    total: shifts.length,
    clockedIn: shifts.filter((s) => s.status === "CLOCKED_IN").length,
    onBreak: shifts.filter((s) => s.status === "ON_BREAK").length,
    completed: shifts.filter((s) => s.status === "CLOCKED_OUT").length,
    totalHours: shifts.reduce((acc, s) => {
      if (!s.clock_in) return acc;
      const start = new Date(s.clock_in);
      const end = s.clock_out ? new Date(s.clock_out) : new Date();
      return acc + (end.getTime() - start.getTime()) / 3600000;
    }, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shifts & Timesheets</h1>
          <p className="text-gray-600">Track employee work hours and timesheets</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchShifts}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={exportTimesheet}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Shifts</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Play className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Clocked In</p>
              <p className="text-xl font-bold text-green-600">{stats.clockedIn}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Coffee className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">On Break</p>
              <p className="text-xl font-bold text-amber-600">{stats.onBreak}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Square className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-xl font-bold text-blue-600">{stats.completed}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <Timer className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Hours</p>
              <p className="text-xl font-bold text-teal-600">
                {stats.totalHours.toFixed(1)}h
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateDate("prev")}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="min-w-[200px] text-center font-medium text-gray-900">
              {formatDateRange()}
            </div>
            <button
              onClick={() => navigateDate("next")}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Date Range Toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(["day", "week", "month"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-sm font-medium capitalize ${
                  dateRange === range
                    ? "bg-teal-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Date Picker */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />

          {/* Staff Filter */}
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">All Staff</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="CLOCKED_IN">Clocked In</option>
            <option value="ON_BREAK">On Break</option>
            <option value="CLOCKED_OUT">Completed</option>
          </select>

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Shifts Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : filteredShifts.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No shifts found for this period</p>
            <p className="text-sm text-gray-400 mt-1">
              Try adjusting your filters or date range
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Clock In
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Clock Out
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Breaks
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mileage
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredShifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {shift.user.first_name?.[0] ||
                            shift.user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {shift.user.first_name} {shift.user.last_name}
                          </p>
                          <p className="text-xs text-gray-500">{shift.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(shift.shift_date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatTime(shift.clock_in)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatTime(shift.clock_out)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {calculateDuration(shift)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {shift.breaks.length > 0 ? (
                        <span className="flex items-center gap-1">
                          <Coffee className="w-3 h-3" />
                          {shift.breaks.length} ({Math.round(
                            shift.breaks.reduce((acc, b) => {
                              const start = new Date(b.break_start);
                              const end = b.break_end ? new Date(b.break_end) : new Date();
                              return acc + (end.getTime() - start.getTime()) / 60000;
                            }, 0)
                          )}m)
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {shift.vehicle_type && (
                        <span className="flex items-center gap-1">
                          <Car className="w-3 h-3" />
                          {calculateMileage(shift)}
                        </span>
                      )}
                      {!shift.vehicle_type && "-"}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(shift.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {filteredShifts.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              Showing <span className="font-medium">{filteredShifts.length}</span>{" "}
              shifts for {formatDateRange()}
            </div>
            <div className="flex gap-6">
              <span>
                Total Work Time:{" "}
                <span className="font-medium text-gray-900">
                  {stats.totalHours.toFixed(1)} hours
                </span>
              </span>
              <span>
                Avg per Shift:{" "}
                <span className="font-medium text-gray-900">
                  {stats.total > 0
                    ? (stats.totalHours / stats.total).toFixed(1)
                    : 0}{" "}
                  hours
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
