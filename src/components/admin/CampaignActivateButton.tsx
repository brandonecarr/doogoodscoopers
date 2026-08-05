"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Rocket, Loader2 } from "lucide-react";

// Launch a draft drip: flips it to active so the cron starts enrolling + sending.
export function CampaignActivateButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const activate = async () => {
    if (!confirm("Activate this drip? It will start enrolling and messaging from now on.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activate: true }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={activate}
      disabled={busy}
      className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
      Activate
    </button>
  );
}
