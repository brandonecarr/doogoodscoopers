"use client";

import { useState, useEffect, useCallback } from "react";
import { Filter, ArrowUpDown, CheckCircle } from "lucide-react";
import { FieldContentCard } from "@/components/portals/field/FieldContentCard";
import { cn } from "@/lib/utils";

interface Shift {
  id: string;
  date: string;
  startTime: string;
  endTime: string | null;
  status: "IN_PROGRESS" | "COMPLETED";
  workHours: string;
  distance: string | null;
  companyVehicle: boolean;
  startNote: string | null;
  endNote: string | null;
}

export default function MyShiftsPage() {
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showSorting, setShowSorting] = useState(false);

  const fetchShifts = useCallback(async () => {
    try {
      const res = await fetch("/api/field/shifts");
      if (res.ok) {
        const data = await res.json();
        setShifts(data.shifts || []);
      }
    } catch (err) {
      console.error("Error fetching shifts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const formatTime = (timeString: string | null) => {
    if (!timeString) return "No data";
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      return "No data";
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toISOString().split("T")[0];
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  return (
    <div className="mt-4">
      {/* Filter/Sort Bar */}
      <div className="flex justify-end gap-2 px-4 mb-4">
        <button
          onClick={() => setShowSorting(!showSorting)}
          className="flex items-center gap-1 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg"
        >
          <ArrowUpDown className="w-4 h-4" />
          SORTING
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1 px-4 py-2 bg-teal-700 text-white text-sm font-medium rounded-lg"
        >
          <Filter className="w-4 h-4" />
          FILTERS
        </button>
      </div>

      {/* Shifts List */}
      {shifts.length === 0 ? (
        <FieldContentCard>
          <div className="py-12 text-center text-gray-500">
            No shifts found
          </div>
        </FieldContentCard>
      ) : (
        <div className="space-y-4">
          {shifts.map((shift) => (
            <FieldContentCard key={shift.id} noPadding>
              {/* Shift Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <span className="text-sm text-gray-600">Shift ID: {shift.id}</span>
                {shift.status === "IN_PROGRESS" ? (
                  <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    In Progress
                  </span>
                ) : (
                  <span className="text-gray-500 text-sm">Completed</span>
                )}
              </div>

              {/* Shift Details */}
              <div className="px-4 py-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Start Date</span>
                  <span className="text-sm text-gray-900">{formatDate(shift.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Start Shift Time</span>
                  <span className="text-sm text-gray-900">{formatTime(shift.startTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">End Shift Time</span>
                  <span className={cn(
                    "text-sm",
                    shift.endTime ? "text-gray-900" : "text-gray-400"
                  )}>
                    {formatTime(shift.endTime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Work Hours</span>
                  <span className="text-sm text-gray-900">{shift.workHours}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Distance</span>
                  <span className={cn(
                    "text-sm",
                    shift.distance ? "text-gray-900" : "text-gray-400"
                  )}>
                    {shift.distance || "No data"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Company vehicle</span>
                  <span className="text-sm text-gray-900">
                    {shift.companyVehicle ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Start Note</span>
                  <span className={cn(
                    "text-sm",
                    shift.startNote ? "text-gray-900" : "text-gray-400"
                  )}>
                    {shift.startNote || "No data"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">End Note</span>
                  <span className={cn(
                    "text-sm",
                    shift.endNote ? "text-gray-900" : "text-gray-400"
                  )}>
                    {shift.endNote || "No data"}
                  </span>
                </div>
              </div>
            </FieldContentCard>
          ))}
        </div>
      )}
    </div>
  );
}
