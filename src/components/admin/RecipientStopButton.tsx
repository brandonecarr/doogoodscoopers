"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";

// Manual "stop" for a single campaign recipient — takes them out of the
// campaign (sets STOPPED) so they receive no further messages.
export function RecipientStopButton({ campaignId, recipientId }: { campaignId: string; recipientId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const stop = async () => {
    if (!confirm("Stop this contact? They'll be removed from the campaign and receive no further messages.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/recipients/${recipientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) router.refresh();
      else setBusy(false);
    } catch {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={stop}
      disabled={busy}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
      title="Stop this contact and remove them from the campaign"
    >
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
      Stop
    </button>
  );
}
