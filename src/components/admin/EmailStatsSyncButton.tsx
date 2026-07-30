"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";

/** Pulls fresh open/click/bounce/unsubscribe stats from Brevo for this blast. */
export function EmailStatsSyncButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sync = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/email-campaigns/${campaignId}/sync-stats`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMsg(`Updated — ${data.openCount} opened, ${data.clickCount} clicked, ${data.bounceCount} bounced.`);
        router.refresh();
      } else {
        setMsg(data.error || "Sync failed");
      }
    } catch {
      setMsg("Sync failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={sync}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-navy-900 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        {busy ? "Syncing…" : "Sync stats from Brevo"}
      </button>
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </div>
  );
}
