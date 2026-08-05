"use client";

import { useState } from "react";
import { Plus, Loader2, Check, ChevronDown } from "lucide-react";

interface Drip { id: string; name: string; targetsCustomers: boolean }

// Customer-profile control: enroll THIS customer into a drip (review) campaign.
// Review-completed customers can't be added — enforced here and on the server.
export function AddToReviewCampaign({ customerId, reviewStatus }: { customerId: string; reviewStatus: string }) {
  const [open, setOpen] = useState(false);
  const [drips, setDrips] = useState<Drip[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (reviewStatus === "REVIEW_COMPLETE") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
        <Check className="w-3.5 h-3.5" /> Review complete — excluded from review campaigns
      </span>
    );
  }

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    setMsg(null);
    if (next && drips === null) {
      try {
        const res = await fetch("/api/admin/campaigns/drips");
        setDrips(res.ok ? (await res.json()).drips ?? [] : []);
      } catch { setDrips([]); }
    }
  };

  const enroll = async (dripId: string, name: string) => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${dripId}/enroll-customers`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds: [customerId] }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.added > 0) setMsg(`Added to “${name}” ✓`);
      else if (res.ok && d.skipped?.[0]) setMsg(`Not added — ${d.skipped[0].reason}.`);
      else setMsg(d.error || "Couldn't add to campaign.");
      setOpen(false);
    } catch { setMsg("Couldn't add to campaign."); }
    finally { setBusy(false); }
  };

  return (
    <div className="relative">
      <button
        onClick={toggle}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        Add to campaign
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-60 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto">
            {drips === null ? (
              <div className="px-3 py-2 text-xs text-gray-400 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>
            ) : drips.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400">No active drip campaigns. Create one first.</div>
            ) : (
              drips.map((d) => (
                <button key={d.id} onClick={() => enroll(d.id, d.name)} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                  <span className="text-navy-900">{d.name}</span>
                  {d.targetsCustomers && <span className="ml-1.5 text-[10px] text-teal-600 bg-teal-50 px-1 py-0.5 rounded">reviews</span>}
                </button>
              ))
            )}
          </div>
        </>
      )}

      {msg && <p className="absolute left-0 top-full mt-1 text-[11px] font-medium text-teal-600 whitespace-nowrap">{msg}</p>}
    </div>
  );
}
