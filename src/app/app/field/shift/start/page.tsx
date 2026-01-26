"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, ArrowRight, Car, Truck } from "lucide-react";
import { FieldContentCard } from "@/components/portals/field/FieldContentCard";
import { useFieldLayout } from "@/components/portals/field/FieldLayoutClient";

interface RouteInfo {
  totalJobs: number;
  startAddress: string;
}

export default function StartShiftPage() {
  const router = useRouter();
  const { refreshShift } = useFieldLayout();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  // Form state
  const [odometer, setOdometer] = useState("");
  const [vehicleType, setVehicleType] = useState<"PERSONAL" | "COMPANY">("PERSONAL");
  const [shiftNotes, setShiftNotes] = useState("");

  // Fetch route info to get start address and job count
  const fetchRouteInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/field/route");
      if (res.ok) {
        const data = await res.json();
        // Get the user's home/start address from the first stop or a default
        const startAddress = data.route?.startAddress || "Your location";
        setRouteInfo({
          totalJobs: data.stats?.total || 0,
          startAddress,
        });
      }
    } catch (err) {
      console.error("Error fetching route:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRouteInfo();
  }, [fetchRouteInfo]);

  const handleClockIn = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/field/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clock_in",
          vehicleType: vehicleType === "PERSONAL" ? "CAR" : "COMPANY_VAN",
          startOdometer: odometer ? parseInt(odometer, 10) : null,
          notes: shiftNotes || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        await refreshShift();
        router.push("/app/field/route");
      } else {
        setError(data.error || "Failed to clock in");
      }
    } catch (err) {
      console.error("Error clocking in:", err);
      setError("Failed to clock in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const openDirections = () => {
    if (routeInfo?.startAddress) {
      const encodedAddress = encodeURIComponent(routeInfo.startAddress);
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
      {/* Header with Jobs link */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 -mx-4 -mt-4 px-4 py-4 rounded-t-xl mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Start shift</h2>
          {routeInfo && routeInfo.totalJobs > 0 && (
            <Link
              href="/app/field/route"
              className="text-teal-600 underline text-sm font-medium"
            >
              Jobs ({routeInfo.totalJobs}/{routeInfo.totalJobs})
            </Link>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Start Address */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">START ADDRESS</p>
          <p className="text-gray-900 font-medium">
            {routeInfo?.startAddress || "Your location"}
          </p>
          <button
            onClick={openDirections}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 border border-teal-500 text-teal-600 rounded-lg hover:bg-teal-50 transition-colors"
          >
            <MapPin className="w-4 h-4" />
            <span className="font-medium">DIRECTIONS</span>
          </button>
        </div>

        {/* Instructions */}
        <p className="text-gray-600">
          Record vehicle mileage and type to begin
        </p>

        {/* Odometer Input */}
        <div>
          <label className="block text-sm text-gray-500 mb-1">
            Odometer Start*
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
        <div>
          <p className="text-sm text-gray-500 mb-2">Please Select</p>
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
        </div>

        {/* Shift Notes */}
        <div>
          <label className="block text-sm text-gray-500 mb-1">
            Start Shift Notes
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

        {/* Clock In Button */}
        <button
          onClick={handleClockIn}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-4 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          <span>CLOCK IN</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </FieldContentCard>
  );
}
