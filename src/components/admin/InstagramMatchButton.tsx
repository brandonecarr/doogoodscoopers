"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Link2 } from "lucide-react";

/**
 * Confirms a click-correlation match: links an Instagram lead to a quote lead.
 * Used on both the Instagram-lead detail (pick a quote) and the quote-lead
 * detail (pick an Instagram lead).
 */
export function InstagramMatchButton({
  instagramLeadId,
  quoteLeadId,
  label = "Link",
  className = "",
}: {
  instagramLeadId: string;
  quoteLeadId: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/instagram/attribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramLeadId, quoteLeadId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={confirm}
      disabled={busy}
      className={
        className ||
        "inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs font-medium disabled:opacity-50"
      }
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}
