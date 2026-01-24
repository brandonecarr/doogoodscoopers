"use client";

import { useState, useEffect } from "react";
import { Clock, Coffee, Truck, LogOut, Play, Pause } from "lucide-react";

interface Shift {
  id: string;
  status: "CLOCKED_IN" | "ON_BREAK" | "CLOCKED_OUT";
  clockInTime: string;
  clockOutTime: string | null;
  vehicleType: string | null;
  startOdometer: number | null;
  currentBreak?: {
    id: string;
    startTime: string;
  } | null;
  totalBreakMinutes: number;
}

interface ShiftCardProps {
  shift: Shift | null;
  onClockIn?: () => void;
  onClockOut?: () => void;
  onStartBreak?: () => void;
  onEndBreak?: () => void;
  loading?: boolean;
}

export function ShiftCard({
  shift,
  onClockIn,
  onClockOut,
  onStartBreak,
  onEndBreak,
  loading = false,
}: ShiftCardProps) {
  const [elapsedTime, setElapsedTime] = useState("");
  const [breakTime, setBreakTime] = useState("");

  // Update elapsed time every second
  useEffect(() => {
    if (!shift || shift.status === "CLOCKED_OUT") return;

    const updateTimes = () => {
      // Calculate shift duration
      const clockIn = new Date(shift.clockInTime);
      const now = new Date();
      const diffMs = now.getTime() - clockIn.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setElapsedTime(`${hours}h ${minutes}m`);

      // Calculate current break duration
      if (shift.currentBreak) {
        const breakStart = new Date(shift.currentBreak.startTime);
        const breakDiffMs = now.getTime() - breakStart.getTime();
        const breakMinutes = Math.floor(breakDiffMs / (1000 * 60));
        const breakSeconds = Math.floor((breakDiffMs % (1000 * 60)) / 1000);
        setBreakTime(`${breakMinutes}:${breakSeconds.toString().padStart(2, "0")}`);
      }
    };

    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, [shift]);

  // Not clocked in
  if (!shift || shift.status === "CLOCKED_OUT") {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Not Clocked In</h3>
          <p className="text-sm text-gray-500 mb-4">Clock in to start your shift</p>
          <button
            onClick={onClockIn}
            disabled={loading}
            className="w-full bg-teal-600 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Play className="w-5 h-5" />
            {loading ? "Loading..." : "Clock In"}
          </button>
        </div>
      </div>
    );
  }

  // On break
  if (shift.status === "ON_BREAK") {
    return (
      <div className="bg-orange-50 rounded-xl shadow-sm p-6 border-2 border-orange-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <Coffee className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-orange-900">On Break</h3>
              <p className="text-sm text-orange-700">{breakTime}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-orange-700">Shift Time</p>
            <p className="text-lg font-bold text-orange-900">{elapsedTime}</p>
          </div>
        </div>

        <button
          onClick={onEndBreak}
          disabled={loading}
          className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Play className="w-5 h-5" />
          {loading ? "Loading..." : "End Break"}
        </button>
      </div>
    );
  }

  // Clocked in and working
  return (
    <div className="bg-green-50 rounded-xl shadow-sm p-6 border-2 border-green-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <Clock className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-green-900">Clocked In</h3>
            <p className="text-sm text-green-700">Since {new Date(shift.clockInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-green-900">{elapsedTime}</p>
        </div>
      </div>

      {/* Vehicle info */}
      {shift.vehicleType && (
        <div className="flex items-center gap-2 text-sm text-green-700 mb-4 pb-4 border-b border-green-200">
          <Truck className="w-4 h-4" />
          <span>{shift.vehicleType}</span>
          {shift.startOdometer && (
            <span className="text-green-600">• Start: {shift.startOdometer.toLocaleString()} mi</span>
          )}
        </div>
      )}

      {/* Break info */}
      {shift.totalBreakMinutes > 0 && (
        <div className="text-sm text-green-600 mb-4">
          Total break time: {shift.totalBreakMinutes} minutes
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onStartBreak}
          disabled={loading}
          className="bg-white text-green-700 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 border border-green-300 disabled:opacity-50"
        >
          <Pause className="w-5 h-5" />
          {loading ? "..." : "Take Break"}
        </button>
        <button
          onClick={onClockOut}
          disabled={loading}
          className="bg-red-600 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <LogOut className="w-5 h-5" />
          {loading ? "..." : "Clock Out"}
        </button>
      </div>
    </div>
  );
}
