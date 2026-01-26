"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { FieldContentCard } from "@/components/portals/field/FieldContentCard";
import { useFieldLayout } from "@/components/portals/field/FieldLayoutClient";

export default function EndBreakPage() {
  const router = useRouter();
  const { refreshShift, shiftStatus } = useFieldLayout();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Redirect if not on break
    if (shiftStatus !== "ON_BREAK") {
      if (shiftStatus === "CLOCKED_IN") {
        router.push("/app/field/route");
      } else {
        router.push("/app/field/shift/start");
      }
    }
  }, [shiftStatus, router]);

  const handleEndBreak = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/field/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "end_break",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        await refreshShift();
        router.push("/app/field/route");
      } else {
        setError(data.error || "Failed to end break");
      }
    } catch (err) {
      console.error("Error ending break:", err);
      setError("Failed to end break. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FieldContentCard className="mt-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 -mx-4 -mt-4 px-4 py-4 rounded-t-xl mb-4">
        <h2 className="text-lg font-semibold text-gray-900">End Break</h2>
      </div>

      <div className="space-y-6">
        <p className="text-gray-600 text-center py-8">
          You are currently on break. Ready to resume work?
        </p>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* End Break Button */}
        <button
          onClick={handleEndBreak}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-4 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          <Play className="w-5 h-5" />
          <span>END BREAK</span>
        </button>
      </div>
    </FieldContentCard>
  );
}
