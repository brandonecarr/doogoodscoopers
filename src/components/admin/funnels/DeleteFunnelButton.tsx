"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

export function DeleteFunnelButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const del = async () => {
    if (!confirm(`Delete the funnel "${name}"?\n\nThis permanently removes it and its analytics, and its /f/ link will stop working. This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/funnels/${id}`, { method: "DELETE" });
      if (!res.ok) { alert("Couldn't delete the funnel. Please try again."); return; }
      router.refresh();
    } catch {
      alert("Something went wrong deleting the funnel.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button onClick={del} disabled={busy} title="Delete funnel"
      className="p-1.5 rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  );
}
