"use client";

import { useState, useEffect, useCallback } from "react";
import { Car, FileText, AlertCircle, Clock, Coffee } from "lucide-react";

interface ActiveShift {
  id: string;
  shiftDate: string;
  clockIn: string;
  startOdometer: number | null;
  vehicleType: string | null;
  status: string;
  notes: string | null;
}

export default function StartEndMyShiftPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeShift, setActiveShift] = useState<ActiveShift | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Clock In form
  const [startOdometer, setStartOdometer] = useState("");
  const [isCompanyVehicle, setIsCompanyVehicle] = useState(true);
  const [startNotes, setStartNotes] = useState("");

  // Clock Out form
  const [endOdometer, setEndOdometer] = useState("");
  const [endNotes, setEndNotes] = useState("");

  const fetchActiveShift = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/admin/shifts?myShifts=true&date=${today}`);
      const data = await res.json();

      if (res.ok) {
        // Find active shift (CLOCKED_IN or ON_BREAK)
        const active = (data.shifts || []).find(
          (s: { status: string }) => s.status === "CLOCKED_IN" || s.status === "ON_BREAK"
        );

        if (active) {
          setActiveShift({
            id: active.id,
            shiftDate: active.shift_date,
            clockIn: active.clock_in,
            startOdometer: active.start_odometer,
            vehicleType: active.vehicle_type,
            status: active.status,
            notes: active.notes,
          });
        } else {
          setActiveShift(null);
        }
      }
    } catch (err) {
      console.error("Error fetching shift:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveShift();
  }, [fetchActiveShift]);

  const handleClockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clock_in",
          start_odometer: startOdometer ? parseFloat(startOdometer) : null,
          vehicle_type: isCompanyVehicle ? "COMPANY" : "PERSONAL",
          notes: startNotes || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("Successfully clocked in!");
        setStartOdometer("");
        setStartNotes("");
        await fetchActiveShift();
      } else {
        setError(data.error || "Failed to clock in");
      }
    } catch (err) {
      console.error("Error clocking in:", err);
      setError("Failed to clock in");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClockOut = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/shifts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clock_out",
          end_odometer: endOdometer ? parseFloat(endOdometer) : null,
          notes: endNotes || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("Successfully clocked out!");
        setEndOdometer("");
        setEndNotes("");
        setActiveShift(null);
      } else {
        setError(data.error || "Failed to clock out");
      }
    } catch (err) {
      console.error("Error clocking out:", err);
      setError("Failed to clock out");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartBreak = async () => {
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/shifts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_break",
          break_type: "REGULAR",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("Break started!");
        await fetchActiveShift();
      } else {
        setError(data.error || "Failed to start break");
      }
    } catch (err) {
      console.error("Error starting break:", err);
      setError("Failed to start break");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndBreak = async () => {
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/shifts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "end_break",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("Break ended!");
        await fetchActiveShift();
      } else {
        setError(data.error || "Failed to end break");
      }
    } catch (err) {
      console.error("Error ending break:", err);
      setError("Failed to end break");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (dateTimeString: string) => {
    return new Date(dateTimeString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculateDuration = (clockIn: string) => {
    const start = new Date(clockIn).getTime();
    const now = Date.now();
    const diffMs = now - start;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error/Success Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 text-green-700 rounded-lg">
          <Clock className="w-5 h-5 flex-shrink-0" />
          {success}
        </div>
      )}

      {!activeShift ? (
        // Clock In Form
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Start Shift</h1>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <form onSubmit={handleClockIn}>
              <div className="flex flex-wrap items-start gap-6">
                {/* Odometer Start */}
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Car className="w-5 h-5" />
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      value={startOdometer}
                      onChange={(e) => setStartOdometer(e.target.value)}
                      placeholder="Odometer Start *"
                      className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-right">
                    {startOdometer.length} / 10
                  </p>
                </div>

                {/* Company Vehicle Toggle */}
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsCompanyVehicle(!isCompanyVehicle)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isCompanyVehicle ? "bg-teal-600" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isCompanyVehicle ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <span className="text-sm font-medium text-gray-700">
                      Company vehicle
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Choose between company and personal vehicle.
                  </p>
                </div>

                {/* Start Shift Notes */}
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <div className="absolute left-3 top-3 text-gray-400">
                      <FileText className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      value={startNotes}
                      onChange={(e) => setStartNotes(e.target.value)}
                      placeholder="Start Shift Notes"
                      className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">(Optional)</p>
                </div>

                {/* Clock In Button */}
                <div className="flex items-start">
                  <button
                    type="submit"
                    disabled={submitting || !startOdometer}
                    className="px-8 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium"
                  >
                    {submitting ? "..." : "CLOCK IN"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : (
        // Clock Out Form
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">End Shift</h1>

          {/* Current Shift Info */}
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div>
                <span className="text-teal-600 font-medium">Status:</span>{" "}
                <span className={activeShift.status === "ON_BREAK" ? "text-orange-600 font-semibold" : "text-teal-700"}>
                  {activeShift.status === "ON_BREAK" ? "On Break" : "Clocked In"}
                </span>
              </div>
              <div>
                <span className="text-teal-600 font-medium">Clock In:</span>{" "}
                <span className="text-teal-700">{formatTime(activeShift.clockIn)}</span>
              </div>
              <div>
                <span className="text-teal-600 font-medium">Duration:</span>{" "}
                <span className="text-teal-700">{calculateDuration(activeShift.clockIn)}</span>
              </div>
              {activeShift.startOdometer !== null && (
                <div>
                  <span className="text-teal-600 font-medium">Start Odometer:</span>{" "}
                  <span className="text-teal-700">{activeShift.startOdometer}</span>
                </div>
              )}
              <div>
                <span className="text-teal-600 font-medium">Vehicle:</span>{" "}
                <span className="text-teal-700">
                  {activeShift.vehicleType === "COMPANY" ? "Company" : "Personal"}
                </span>
              </div>
            </div>
          </div>

          {/* Break Buttons */}
          <div className="flex gap-3">
            {activeShift.status === "CLOCKED_IN" ? (
              <button
                onClick={handleStartBreak}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 disabled:opacity-50 font-medium"
              >
                <Coffee className="w-4 h-4" />
                Start Break
              </button>
            ) : (
              <button
                onClick={handleEndBreak}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 font-medium"
              >
                <Coffee className="w-4 h-4" />
                End Break
              </button>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <form onSubmit={handleClockOut}>
              <div className="flex flex-wrap items-start gap-6">
                {/* Odometer End */}
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Car className="w-5 h-5" />
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      value={endOdometer}
                      onChange={(e) => setEndOdometer(e.target.value)}
                      placeholder="Odometer End *"
                      className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-right">
                    {endOdometer.length} / 10
                  </p>
                </div>

                {/* End Shift Notes */}
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <div className="absolute left-3 top-3 text-gray-400">
                      <FileText className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      value={endNotes}
                      onChange={(e) => setEndNotes(e.target.value)}
                      placeholder="End Shift Notes"
                      className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">(Optional)</p>
                </div>

                {/* Clock Out Button */}
                <div className="flex items-start">
                  <button
                    type="submit"
                    disabled={submitting || !endOdometer}
                    className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
                  >
                    {submitting ? "..." : "CLOCK OUT"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
