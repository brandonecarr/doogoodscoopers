"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, X, Loader2 } from "lucide-react";

/**
 * The approval gate for an SMS blast. A blast is fully built (audience resolved,
 * message set) but held in PENDING_APPROVAL until the owner reviews the count +
 * message here and explicitly approves. Nothing is sent before Approve is clicked.
 */
export function BlastApproval({ campaignId, recipientCount }: { campaignId: string; recipientCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  const act = async (kind: "approve" | "reject") => {
    if (kind === "approve" && !confirm(`Send this text to ${recipientCount} recipient${recipientCount === 1 ? "" : "s"} now? This can't be undone.`)) return;
    if (kind === "reject" && !confirm("Cancel this blast and move it back to draft? Nothing will be sent.")) return;
    setBusy(kind);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "approve" ? { approve: true } : { reject: true }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Couldn't update the blast.");
        return;
      }
      router.refresh();
    } catch {
      alert("Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => act("approve")}
        disabled={!!busy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-bold text-white disabled:opacity-60"
        style={{ background: "#16A34A" }}
      >
        {busy === "approve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
        Approve &amp; send{recipientCount ? ` (${recipientCount})` : ""}
      </button>
      <button
        onClick={() => act("reject")}
        disabled={!!busy}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-60"
      >
        {busy === "reject" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
        Cancel
      </button>
    </div>
  );
}
