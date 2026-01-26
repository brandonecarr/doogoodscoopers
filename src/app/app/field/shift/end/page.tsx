"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MapPin, LogOut, Car, Truck } from "lucide-react";
import { FieldContentCard } from "@/components/portals/field/FieldContentCard";
import { useFieldLayout } from "@/components/portals/field/FieldLayoutClient";

interface ShiftInfo {
  id: string;
  startOdometer: number | null;
  vehicleType: string | null;
  endAddress: string;
}

export default function EndShiftPage() {
  const router = useRouter();
  const { refreshShift, shiftStatus } = useFieldLayout();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shiftInfo, setShiftInfo] = useState<ShiftInfo | null>(null);

  // Form state
  const [odometer, setOdometer] = useState("");
  const [vehicleType, setVehicleType] = useState<"PERSONAL" | "COMPANY">("PERSONAL");
  const [shiftNotes, setShiftNotes] = useState("");

  // Fetch current shift info
  const fetchShiftInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/field/shift");
      if (res.ok) {
        const data = await res.json();
        if (data.shift) {
          setShiftInfo({
            id: data.shift.id,
            startOdometer: data.shift.startOdometer,
            vehicleType: data.shift.vehicleType,
            endAddress: data.shift.endAddress || "Your location",
          });
          // Set vehicle type based on current shift
          if (data.shift.vehicleType) {
            setVehicleType(
              data.shift.vehicleType.includes("COMPANY") ? "COMPANY" : "PERSONAL"
            );
          }
        }
      }
    } catch (err) {
      console.error("Error fetching shift:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Redirect if not clocked in
    if (shiftStatus === null || shiftStatus === "CLOCKED_OUT") {
      router.push("/app/field/shift/start");
      return;
    }
    fetchShiftInfo();
  }, [fetchShiftInfo, shiftStatus, router]);

  const handleClockOut = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/field/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clock_out",
          endOdometer: odometer ? parseInt(odometer, 10) : null,
          notes: shiftNotes || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        await refreshShift();
        router.push("/app/field");
      } else {
        setError(data.error || "Failed to clock out");
      }
    } catch (err) {
      console.error("Error clocking out:", err);
      setError("Failed to clock out. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const openDirections = () => {
    if (shiftInfo?.endAddress) {
      const encodedAddress = encodeURIComponent(shiftInfo.endAddress);
      window.open(`https://maps.google.com/?daddr=${encodedAddress}`, "_blank");
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
    <FieldContentCard className="mt-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 -mx-4 -mt-4 px-4 py-4 rounded-t-xl mb-4">
        <h2 className="text-lg font-semibold text-gray-900">End shift</h2>
      </div>

      <div className="space-y-6">
        {/* End Address */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">END ADDRESS</p>
          <p className="text-gray-900 font-medium">
            {shiftInfo?.endAddress || "Your location"}
          </p>
          <button
            onClick={openDirections}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 border border-teal-500 text-teal-600 rounded-lg hover:bg-teal-50 transition-colors"
          >
            <MapPin className="w-4 h-4" />
            <span className="font-medium">DIRECTIONS</span>
          </button>
        </div>

        {/* Odometer Input */}
        <div>
          <label className="block text-sm text-gray-500 mb-1">
            Odometer End*
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={odometer}
            onChange={(e) => setOdometer(e.target.value.replace(/\D/g, ""))}
            placeholder="0000"
            className="w-full text-lg font-medium text-gray-900 border-b-2 border-gray-300 focus:border-teal-500 outline-none py-2 bg-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">Enter last 4 digits only</p>
        </div>

        {/* Vehicle Type Toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-300">
          <button
            type="button"
            onClick={() => setVehicleType("PERSONAL")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 font-medium transition-colors ${
              vehicleType === "PERSONAL"
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            <Car className="w-5 h-5" />
            <span>Personal Vehicle</span>
          </button>
          <button
            type="button"
            onClick={() => setVehicleType("COMPANY")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 font-medium transition-colors ${
              vehicleType === "COMPANY"
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            <Truck className="w-5 h-5" />
            <span>Company Vehicle</span>
          </button>
        </div>

        {/* Shift Notes */}
        <div>
          <label className="block text-sm text-gray-500 mb-1">
            Enter Shift Note
          </label>
          <input
            type="text"
            value={shiftNotes}
            onChange={(e) => setShiftNotes(e.target.value)}
            placeholder="Enter"
            className="w-full text-gray-900 border-b-2 border-gray-300 focus:border-teal-500 outline-none py-2 bg-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">Optional</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Clock Out Button */}
        <button
          onClick={handleClockOut}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-4 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>CLOCK OUT</span>
        </button>
      </div>
    </FieldContentCard>
  );
}
