"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ShiftCard } from "@/components/portals/field/ShiftCard";
import { VehicleSelector } from "@/components/portals/field/VehicleSelector";
import { OdometerInput } from "@/components/portals/field/OdometerInput";
import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";

interface Shift {
  id: string;
  status: "CLOCKED_IN" | "ON_BREAK" | "CLOCKED_OUT";
  clockInTime: string;
  clockOutTime: string | null;
  vehicleType: string | null;
  startOdometer: number | null;
  endOdometer: number | null;
  currentBreak?: {
    id: string;
    startTime: string;
  } | null;
  totalBreakMinutes: number;
}

export default function ShiftPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shift, setShift] = useState<Shift | null>(null);

  // Clock in form state
  const [showClockInForm, setShowClockInForm] = useState(false);
  const [vehicleType, setVehicleType] = useState<string | null>(null);
  const [startOdometer, setStartOdometer] = useState<number | null>(null);
  const [formErrors, setFormErrors] = useState<{ vehicle?: string; odometer?: string }>({});

  // Clock out form state
  const [showClockOutForm, setShowClockOutForm] = useState(false);
  const [endOdometer, setEndOdometer] = useState<number | null>(null);

  // Fetch current shift
  const fetchShift = useCallback(async () => {
    try {
      const res = await fetch("/api/field/shift");
      const data = await res.json();

      if (res.ok && data.shift) {
        setShift(data.shift);
      } else {
        setShift(null);
      }
    } catch (err) {
      console.error("Error fetching shift:", err);
      setError("Failed to load shift status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShift();
  }, [fetchShift]);

  // Clock in handler
  const handleClockIn = async () => {
    // Validate form
    const errors: { vehicle?: string; odometer?: string } = {};
    if (!vehicleType) {
      errors.vehicle = "Please select a vehicle";
    }
    if (vehicleType && vehicleType !== "BIKE" && !startOdometer) {
      errors.odometer = "Please enter the odometer reading";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/field/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clock_in",
          vehicleType,
          startOdometer: vehicleType === "BIKE" ? null : startOdometer,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setShift(data.shift);
        setShowClockInForm(false);
        router.push("/app/field");
      } else {
        setError(data.error || "Failed to clock in");
      }
    } catch (err) {
      console.error("Error clocking in:", err);
      setError("Failed to clock in. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  // Clock out handler
  const handleClockOut = async () => {
    // If vehicle requires odometer, show form
    if (shift?.vehicleType && shift.vehicleType !== "BIKE" && !showClockOutForm) {
      setShowClockOutForm(true);
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/field/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clock_out",
          endOdometer: shift?.vehicleType === "BIKE" ? null : endOdometer,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setShift({ ...shift!, status: "CLOCKED_OUT", clockOutTime: new Date().toISOString() });
        setShowClockOutForm(false);
      } else {
        setError(data.error || "Failed to clock out");
      }
    } catch (err) {
      console.error("Error clocking out:", err);
      setError("Failed to clock out. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  // Start break handler
  const handleStartBreak = async () => {
    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/field/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_break" }),
      });

      const data = await res.json();

      if (res.ok) {
        setShift({
          ...shift!,
          status: "ON_BREAK",
          currentBreak: data.break,
        });
      } else {
        setError(data.error || "Failed to start break");
      }
    } catch (err) {
      console.error("Error starting break:", err);
      setError("Failed to start break. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  // End break handler
  const handleEndBreak = async () => {
    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/field/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end_break" }),
      });

      const data = await res.json();

      if (res.ok) {
        setShift({
          ...shift!,
          status: "CLOCKED_IN",
          currentBreak: null,
          totalBreakMinutes: data.totalBreakMinutes,
        });
      } else {
        setError(data.error || "Failed to end break");
      }
    } catch (err) {
      console.error("Error ending break:", err);
      setError("Failed to end break. Please try again.");
    } finally {
      setActionLoading(false);
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/app/field"
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Shift Management</h1>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Clock In Form */}
      {showClockInForm && !shift ? (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Start Your Shift</h2>

          <VehicleSelector
            value={vehicleType}
            onChange={(v) => {
              setVehicleType(v);
              setFormErrors({});
            }}
            error={formErrors.vehicle}
          />

          {vehicleType && vehicleType !== "BIKE" && (
            <OdometerInput
              value={startOdometer}
              onChange={(v) => {
                setStartOdometer(v);
                setFormErrors({});
              }}
              label="Starting Odometer"
              required
              error={formErrors.odometer}
            />
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setShowClockInForm(false)}
              className="flex-1 py-3 px-4 rounded-lg font-medium text-gray-700 bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleClockIn}
              disabled={actionLoading}
              className="flex-1 py-3 px-4 rounded-lg font-medium text-white bg-teal-600 disabled:opacity-50"
            >
              {actionLoading ? "Clocking In..." : "Clock In"}
            </button>
          </div>
        </div>
      ) : showClockOutForm && shift ? (
        /* Clock Out Form */
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">End Your Shift</h2>

          <OdometerInput
            value={endOdometer}
            onChange={setEndOdometer}
            label="Ending Odometer"
            required
          />

          {shift.startOdometer && endOdometer && endOdometer > shift.startOdometer && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                Miles driven today:{" "}
                <span className="font-semibold text-gray-900">
                  {(endOdometer - shift.startOdometer).toLocaleString()}
                </span>
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setShowClockOutForm(false)}
              className="flex-1 py-3 px-4 rounded-lg font-medium text-gray-700 bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleClockOut}
              disabled={actionLoading || !endOdometer}
              className="flex-1 py-3 px-4 rounded-lg font-medium text-white bg-red-600 disabled:opacity-50"
            >
              {actionLoading ? "Clocking Out..." : "Clock Out"}
            </button>
          </div>
        </div>
      ) : (
        /* Shift Card */
        <ShiftCard
          shift={shift}
          onClockIn={() => setShowClockInForm(true)}
          onClockOut={handleClockOut}
          onStartBreak={handleStartBreak}
          onEndBreak={handleEndBreak}
          loading={actionLoading}
        />
      )}

      {/* Today's Summary (when clocked in) */}
      {shift && shift.status !== "CLOCKED_OUT" && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Today&apos;s Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Clock In Time</span>
              <span className="text-gray-900 font-medium">
                {new Date(shift.clockInTime).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {shift.vehicleType && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Vehicle</span>
                <span className="text-gray-900 font-medium">
                  {shift.vehicleType.replace("_", " ")}
                </span>
              </div>
            )}
            {shift.startOdometer && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Start Odometer</span>
                <span className="text-gray-900 font-medium">
                  {shift.startOdometer.toLocaleString()} mi
                </span>
              </div>
            )}
            {shift.totalBreakMinutes > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Break Time</span>
                <span className="text-gray-900 font-medium">
                  {shift.totalBreakMinutes} minutes
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
