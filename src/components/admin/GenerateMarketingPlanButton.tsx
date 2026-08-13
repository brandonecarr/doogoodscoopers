"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";

export function GenerateMarketingPlanButton({ regenerate = false, label }: { regenerate?: boolean; label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/marketing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Couldn't generate the plan."); return; }
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const Icon = loading ? Loader2 : regenerate ? RefreshCw : Sparkles;
  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-[12px] text-[13px] font-bold text-white transition-colors disabled:opacity-60"
        style={{ background: "#8B6BFF" }}
      >
        <Icon className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Your director is planning…" : label ?? (regenerate ? "Regenerate this week" : "Generate this week's plan")}
      </button>
      {loading && <span className="text-[11px] text-muted">This takes about a minute.</span>}
      {error && <span className="text-[12px] text-rose-600">{error}</span>}
    </div>
  );
}
