"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LeadStatus } from "@/types/leads";

interface StatusUpdateFormProps {
  leadId: string;
  leadType: "quote" | "outofarea" | "career" | "commercial" | "adlead";
  currentStatus: LeadStatus;
  notes: string | null;
}

const statusOptions: { value: LeadStatus; label: string; color: string }[] = [
  { value: "NEW", label: "New", color: "bg-teal-500" },
  { value: "CONTACTED", label: "Contacted", color: "bg-blue-500" },
  { value: "QUALIFIED", label: "Qualified", color: "bg-purple-500" },
  { value: "CONVERTED", label: "Converted", color: "bg-green-500" },
  { value: "LOST", label: "Lost", color: "bg-gray-500" },
];

export default function StatusUpdateForm({
  leadId,
  leadType,
  currentStatus,
  notes: initialNotes,
}: StatusUpdateFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [notes, setNotes] = useState(initialNotes || "");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/update-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          leadType,
          status,
          notes,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: "success", text: "Lead updated successfully" });
        router.refresh();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to update lead" });
      }
    } catch {
      setMessage({ type: "error", text: "An error occurred" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-navy-900 mb-4">Update Status</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Status Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <div className="grid grid-cols-1 gap-2">
            {statusOptions.map((option) => (
              <label
                key={option.value}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  status === option.value
                    ? "border-teal-500 bg-teal-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={option.value}
                  checked={status === option.value}
                  onChange={(e) => setStatus(e.target.value as LeadStatus)}
                  className="sr-only"
                />
                <div className={`w-3 h-3 rounded-full ${option.color}`} />
                <span className="text-sm font-medium text-navy-900">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
            placeholder="Add notes about this lead..."
          />
        </div>

        {/* Message */}
        {message && (
          <div
            className={`p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Updating..." : "Update Lead"}
        </button>
      </form>
    </div>
  );
}
