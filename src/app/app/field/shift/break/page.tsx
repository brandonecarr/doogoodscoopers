"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Car, Truck } from "lucide-react";
import { FieldContentCard } from "@/components/portals/field/FieldContentCard";
import { useFieldLayout } from "@/components/portals/field/FieldLayoutClient";

export default function StartBreakPage() {
  const router = useRouter();
  const { refreshShift, shiftStatus } = useFieldLayout();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [odometer, setOdometer] = useState("");
  const [vehicleType, setVehicleType] = useState<"PERSONAL" | "COMPANY">("PERSONAL");
  const [breakNote, setBreakNote] = useState("");

  useEffect(() => {
    // Redirect if not clocked in or already on break
    if (shiftStatus !== "CLOCKED_IN") {
      if (shiftStatus === "ON_BREAK") {
        router.push("/app/field/shift/end-break");
      } else {
        router.push("/app/field/shift/start");
      }
    }
  }, [shiftStatus, router]);

  const handleStartBreak = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/field/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_break",
          odometer: odometer ? parseInt(odometer, 10) : null,
          notes: breakNote || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        await refreshShift();
        router.push("/app/field");
      } else {
        setError(data.error || "Failed to start break");
      }
    } catch (err) {
      console.error("Error starting break:", err);
      setError("Failed to start break. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FieldContentCard className="mt-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 -mx-4 -mt-4 px-4 py-4 rounded-t-xl mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Start Break</h2>
      </div>

      <div className="space-y-6">
        {/* Odometer Input */}
        <div>
          <label className="block text-sm text-gray-500 mb-1">
            Odometer Break
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

        {/* Break Notes */}
        <div>
          <label className="block text-sm text-gray-500 mb-1">
            Break Note
          </label>
          <input
            type="text"
            value={breakNote}
            onChange={(e) => setBreakNote(e.target.value)}
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

        {/* Start Break Button */}
        <button
          onClick={handleStartBreak}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-4 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>START BREAK</span>
        </button>
      </div>
    </FieldContentCard>
  );
}
