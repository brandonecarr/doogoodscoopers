"use client";

import { useState } from "react";
import { Navigation, Check, AlertCircle } from "lucide-react";

interface OnTheWayButtonProps {
  jobId: string;
  status: string;
  onSent: () => void;
}

export function OnTheWayButton({ jobId, status, onSent }: OnTheWayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show for SCHEDULED jobs
  if (status !== "SCHEDULED") {
    return null;
  }

  const handleSend = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/field/job/${jobId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (res.ok) {
        setSent(true);
        onSent();
      } else {
        setError(data.error || "Failed to send notification");
      }
    } catch (err) {
      console.error("Error sending notification:", err);
      setError("Failed to send. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="bg-green-100 text-green-700 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2">
        <Check className="w-5 h-5" />
        Client Notified
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-2 bg-red-50 border border-red-200 rounded-lg p-2 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}
      <button
        onClick={handleSend}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Navigation className="w-5 h-5" />
        {loading ? "Sending..." : "I'm On My Way"}
      </button>
    </div>
  );
}
