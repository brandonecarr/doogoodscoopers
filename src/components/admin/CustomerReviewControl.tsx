"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export const REVIEW_OPTIONS = [
  { value: "NO_REVIEW", label: "No Review" },
  { value: "REQUEST_SENT", label: "Request Sent" },
  { value: "REVIEW_COMPLETE", label: "Review Complete" },
] as const;

const STYLES: Record<string, string> = {
  NO_REVIEW: "bg-gray-100 text-gray-600 border-gray-200",
  REQUEST_SENT: "bg-blue-100 text-blue-800 border-blue-200",
  REVIEW_COMPLETE: "bg-green-100 text-green-800 border-green-200",
};

// A badge-styled dropdown for a customer's review status. Saves on change.
export function CustomerReviewControl({
  customerId,
  value,
  size = "sm",
}: {
  customerId: string;
  value: string;
  size?: "sm" | "md";
}) {
  const [status, setStatus] = useState(value);
  const [busy, setBusy] = useState(false);

  async function change(next: string) {
    const prev = status;
    setStatus(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus: next }),
      });
      if (!res.ok) setStatus(prev);
    } catch {
      setStatus(prev);
    } finally {
      setBusy(false);
    }
  }

  const pad = size === "md" ? "px-3 py-1.5 text-sm" : "px-2 py-1 text-xs";

  return (
    <span className="relative inline-flex items-center">
      <select
        value={status}
        disabled={busy}
        onChange={(e) => change(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className={`appearance-none rounded-full border font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60 ${pad} ${STYLES[status] || STYLES.NO_REVIEW}`}
      >
        {REVIEW_OPTIONS.map((o) => (
          <option key={o.value} value={o.value} className="bg-white text-gray-900">
            {o.label}
          </option>
        ))}
      </select>
      {busy && <Loader2 className="w-3 h-3 animate-spin text-gray-400 ml-1" />}
    </span>
  );
}
