"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";

/**
 * `sm` suits the dense campaigns list; `md` matches the Edit button on the
 * campaign detail header so the two read as a matched pair.
 */
export function CampaignPauseToggle({
  campaignId,
  active,
  size = "sm",
}: {
  campaignId: string;
  active: boolean;
  size?: "sm" | "md";
}) {
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
      // The site's standard secondary button (same as Templates / Contacts /
      // Automations); `sm` is the compact form for the dense campaigns list.
      className={`inline-flex items-center gap-1.5 border border-gray-200 text-navy-900 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 ${
        size === "md" ? "px-4 py-2" : "px-3 py-1.5"
      }`}
      title={active ? "Pause drip" : "Resume drip"}
    >
      {active ? <Pause className={size === "md" ? "w-4 h-4" : "w-3.5 h-3.5"} /> : <Play className={size === "md" ? "w-4 h-4" : "w-3.5 h-3.5"} />}
      {active ? "Pause" : "Resume"}
    </button>
  );
}
