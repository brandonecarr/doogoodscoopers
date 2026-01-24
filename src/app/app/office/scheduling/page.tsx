"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  ArrowRight,
} from "lucide-react";

interface DaySummary {
  date: string;
  total_jobs: number;
  scheduled: number;
  completed: number;
  skipped: number;
  canceled: number;
  unassigned: number;
  routes_count: number;
  revenue_scheduled: number;
  revenue_completed: number;
}

interface CalendarData {
  startDate: string;
  endDate: string;
  calendar: DaySummary[];
  totals: {
    total_jobs: number;
    scheduled: number;
    completed: number;
    skipped: number;
    canceled: number;
    unassigned: number;
    revenue_scheduled: number;
    revenue_completed: number;
  };
}

export default function SchedulingPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendarData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    try {
      const response = await fetch(
        `/api/admin/scheduling/calendar?startDate=${startDate.toISOString().split("T")[0]}&endDate=${endDate.toISOString().split("T")[0]}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch calendar data");
      }

      const data = await response.json();
      setCalendarData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getDateData = (date: Date): DaySummary | undefined => {
    if (!calendarData) return undefined;
    const dateStr = date.toISOString().split("T")[0];
    return calendarData.calendar.find((d) => d.date === dateStr);
  };

  const renderCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const days: React.ReactNode[] = [];

    // Previous month padding
    const prevMonth = new Date(year, month, 0);
    for (let i = startPadding - 1; i >= 0; i--) {
      const day = prevMonth.getDate() - i;
      days.push(
        <div key={`prev-${i}`} className="p-2 bg-gray-50 text-gray-400 min-h-[100px]">
          <span className="text-sm">{day}</span>
        </div>
      );
    }

    // Current month days
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const isToday = date.getTime() === today.getTime();
      const isPast = date < today;
      const data = getDateData(date);

      days.push(
        <div
          key={day}
          className={`p-2 min-h-[100px] border-b border-r transition-colors cursor-pointer hover:bg-gray-50 ${
            isToday ? "bg-teal-50 border-teal-200" : ""
          } ${isPast ? "bg-gray-50" : ""}`}
          onClick={() => {
            window.location.href = `/app/office/dispatch?date=${date.toISOString().split("T")[0]}`;
          }}
        >
          <div className="flex justify-between items-start">
            <span
              className={`text-sm font-medium ${
                isToday
                  ? "bg-teal-600 text-white w-6 h-6 rounded-full flex items-center justify-center"
                  : isPast
                  ? "text-gray-400"
                  : "text-gray-900"
              }`}
            >
              {day}
            </span>
            {data && data.routes_count > 0 && (
              <span className="text-xs text-gray-500">{data.routes_count} routes</span>
            )}
          </div>

          {data && data.total_jobs > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center text-xs">
                <span className="text-gray-600">{data.total_jobs} jobs</span>
              </div>

              <div className="flex gap-1 flex-wrap">
                {data.completed > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                    <CheckCircle className="w-3 h-3 mr-0.5" />
                    {data.completed}
                  </span>
                )}
                {data.scheduled > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                    <Clock className="w-3 h-3 mr-0.5" />
                    {data.scheduled}
                  </span>
                )}
                {data.skipped > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">
                    <ArrowRight className="w-3 h-3 mr-0.5" />
                    {data.skipped}
                  </span>
                )}
                {data.canceled > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                    <XCircle className="w-3 h-3 mr-0.5" />
                    {data.canceled}
                  </span>
                )}
              </div>

              {data.unassigned > 0 && (
                <div className="text-xs text-orange-600 font-medium">
                  {data.unassigned} unassigned
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Next month padding
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push(
        <div key={`next-${i}`} className="p-2 bg-gray-50 text-gray-400 min-h-[100px]">
          <span className="text-sm">{i}</span>
        </div>
      );
    }

    return days;
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scheduling</h1>
          <p className="text-gray-600">View and manage service schedules</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={goToToday}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Today
          </button>
          <a
            href="/api/v2/cron/generate-jobs"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Generate Jobs
          </a>
        </div>
      </div>

      {/* Month Stats */}
      {calendarData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Total Jobs</div>
            <div className="text-2xl font-bold text-gray-900">{calendarData.totals.total_jobs}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Completed</div>
            <div className="text-2xl font-bold text-green-600">{calendarData.totals.completed}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Revenue</div>
            <div className="text-2xl font-bold text-gray-900">
              ${(calendarData.totals.revenue_completed / 100).toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Unassigned</div>
            <div className="text-2xl font-bold text-orange-600">{calendarData.totals.unassigned}</div>
          </div>
        </div>
      )}

      {/* Calendar Header */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-gray-400" />
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex items-center justify-center py-12 text-red-600">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}

        {/* Calendar Grid */}
        {!loading && !error && (
          <>
            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="p-2 text-center text-sm font-medium text-gray-500 bg-gray-50"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7">
              {renderCalendarDays()}
            </div>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
        <div className="flex items-center">
          <span className="w-3 h-3 rounded-full bg-green-500 mr-2" />
          Completed
        </div>
        <div className="flex items-center">
          <span className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
          Scheduled
        </div>
        <div className="flex items-center">
          <span className="w-3 h-3 rounded-full bg-yellow-500 mr-2" />
          Skipped
        </div>
        <div className="flex items-center">
          <span className="w-3 h-3 rounded-full bg-red-500 mr-2" />
          Canceled
        </div>
        <div className="flex items-center">
          <span className="w-3 h-3 rounded-full bg-orange-500 mr-2" />
          Unassigned
        </div>
      </div>
    </div>
  );
}
