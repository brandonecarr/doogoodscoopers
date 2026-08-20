"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { heroBtnPrimary, heroPrimaryStyle } from "@/components/admin/PageHero";

export function NewFunnelButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/funnels", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled funnel" }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.id) router.push(`/admin/funnels/${d.id}`);
    } finally { setBusy(false); }
  };
  return (
    <button onClick={create} disabled={busy} className={heroBtnPrimary} style={heroPrimaryStyle}>
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} New funnel
    </button>
  );
}
