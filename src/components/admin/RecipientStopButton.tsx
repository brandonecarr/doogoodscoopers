"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle, RotateCcw } from "lucide-react";

// Manual stop/restart for a single campaign recipient. STOPPED recipients show
// "Restart" (resume on the original schedule); in-flight recipients show "Stop".
export function RecipientStopButton({
  campaignId,
  recipientId,
  stopped: initialStopped,
}: {
  campaignId: string;
  recipientId: string;
  stopped: boolean;
}) {
  const router = useRouter();
  // Track state locally so the button flips instantly, without waiting for the
  // server round-trip / a manual page refresh.
  const [stopped, setStopped] = useState(initialStopped);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const action = stopped ? "restart" : "stop";
    if (
      !stopped &&
      !confirm("Stop this contact? They'll be removed from the campaign and receive no further messages.")
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/recipients/${recipientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setStopped(!stopped);
        router.refresh(); // sync the status badge + stats
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={run}
      disabled={busy}
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border disabled:opacity-50 ${
        stopped
          ? "border-teal-200 text-teal-600 hover:bg-teal-50"
          : "border-red-200 text-red-600 hover:bg-red-50"
      }`}
      title={stopped ? "Restart this contact on its original schedule" : "Stop this contact and remove them from the campaign"}
    >
      {busy ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : stopped ? (
        <RotateCcw className="w-3 h-3" />
      ) : (
        <XCircle className="w-3 h-3" />
      )}
      {stopped ? "Restart" : "Stop"}
    </button>
  );
}
