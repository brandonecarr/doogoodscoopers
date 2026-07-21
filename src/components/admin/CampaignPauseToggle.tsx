"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";

export function CampaignPauseToggle({ campaignId, active }: { campaignId: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      title={active ? "Pause drip" : "Resume drip"}
    >
      {active ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
      {active ? "Pause" : "Resume"}
    </button>
  );
}
