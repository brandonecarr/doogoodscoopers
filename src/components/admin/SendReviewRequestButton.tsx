"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Check } from "lucide-react";

// Sends a one-off review-request text to a single customer.
export function SendReviewRequestButton({ customerId, hasPhone }: { customerId: string; hasPhone: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    if (!confirm("Text this customer a Google review request now?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/review/send`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setSent(true);
        router.refresh();
        setTimeout(() => setSent(false), 2500);
      } else {
        setError(d.error || "Failed to send.");
      }
    } catch {
      setError("Failed to send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={send}
        disabled={busy || !hasPhone}
        title={hasPhone ? "Send a review-request text now" : "No phone number on file"}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : sent ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
        {sent ? "Sent" : "Send review request"}
      </button>
      {error && <p className="text-xs text-red-600 max-w-xs text-right">{error}</p>}
    </div>
  );
}
