"use client";

import { useState } from "react";
import { Play, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface JobActionButtonsProps {
  jobId: string;
  status: string;
  onStatusChange: (newStatus: string) => void;
}

const SKIP_REASONS = [
  "Gate locked",
  "Dog in yard",
  "Customer request",
  "Weather",
  "Unsafe conditions",
  "No access",
  "Other",
];

export function JobActionButtons({ jobId, status, onStatusChange }: JobActionButtonsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const performAction = async (action: string, additionalData?: Record<string, unknown>) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/field/job/${jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...additionalData }),
      });

      const data = await res.json();

      if (res.ok) {
        onStatusChange(data.job.status);
        setShowSkipModal(false);
      } else {
        setError(data.error || "Action failed");
      }
    } catch (err) {
      console.error("Error performing action:", err);
      setError("Failed to update job. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    const reason = skipReason === "Other" ? customReason : skipReason;
    if (!reason) {
      setError("Please select a reason");
      return;
    }
    performAction("skip", { skipReason: reason });
  };

  // Render based on current status
  if (status === "COMPLETED" || status === "SKIPPED") {
    return (
      <div className={`p-4 rounded-xl text-center ${
        status === "COMPLETED" ? "bg-green-100" : "bg-red-100"
      }`}>
        {status === "COMPLETED" ? (
          <div className="flex items-center justify-center gap-2 text-green-700">
            <CheckCircle className="w-6 h-6" />
            <span className="font-semibold">Job Completed</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-red-700">
            <XCircle className="w-6 h-6" />
            <span className="font-semibold">Job Skipped</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Skip Modal */}
      {showSkipModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4 animate-slide-up">
            <h3 className="text-lg font-bold text-gray-900">Skip This Job</h3>
            <p className="text-sm text-gray-500">Select a reason for skipping:</p>

            <div className="space-y-2">
              {SKIP_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setSkipReason(reason)}
                  className={`w-full text-left px-4 py-3 rounded-lg border ${
                    skipReason === reason
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-gray-200 text-gray-700"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            {skipReason === "Other" && (
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter reason..."
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-teal-500 focus:border-teal-500"
                rows={2}
              />
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowSkipModal(false)}
                className="flex-1 py-3 px-4 rounded-lg font-medium text-gray-700 bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSkip}
                disabled={loading || !skipReason || (skipReason === "Other" && !customReason)}
                className="flex-1 py-3 px-4 rounded-lg font-medium text-white bg-red-600 disabled:opacity-50"
              >
                {loading ? "Skipping..." : "Skip Job"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        {status === "SCHEDULED" && (
          <>
            <button
              onClick={() => performAction("start")}
              disabled={loading}
              className="col-span-2 bg-teal-600 text-white py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Play className="w-5 h-5" />
              {loading ? "Starting..." : "Start Job"}
            </button>
            <button
              onClick={() => setShowSkipModal(true)}
              disabled={loading}
              className="col-span-2 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2"
            >
              <XCircle className="w-5 h-5" />
              Skip Job
            </button>
          </>
        )}

        {status === "EN_ROUTE" && (
          <>
            <button
              onClick={() => performAction("start")}
              disabled={loading}
              className="col-span-2 bg-teal-600 text-white py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Play className="w-5 h-5" />
              {loading ? "Starting..." : "Start Job"}
            </button>
            <button
              onClick={() => setShowSkipModal(true)}
              disabled={loading}
              className="col-span-2 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2"
            >
              <XCircle className="w-5 h-5" />
              Skip Job
            </button>
          </>
        )}

        {status === "IN_PROGRESS" && (
          <>
            <button
              onClick={() => performAction("complete")}
              disabled={loading}
              className="col-span-2 bg-green-600 text-white py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CheckCircle className="w-5 h-5" />
              {loading ? "Completing..." : "Complete Job"}
            </button>
            <button
              onClick={() => setShowSkipModal(true)}
              disabled={loading}
              className="col-span-2 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2"
            >
              <XCircle className="w-5 h-5" />
              Skip Job
            </button>
          </>
        )}
      </div>
    </div>
  );
}
