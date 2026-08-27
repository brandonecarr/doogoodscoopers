"use client";

import { useEffect, useState } from "react";
import { CreditCard, Loader2, Check, AlertTriangle } from "lucide-react";

const money = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

/**
 * Failed-payment recovery. Non-payment cancelled real subscriptions — customers
 * who never chose to leave, they just had a card decline nobody told them about.
 * Off by default: detection and owner alerts run either way, but customers are
 * only texted once this is switched on.
 */
export function FailedPaymentCard() {
  const [enabled, setEnabled] = useState(false);
  const [payLink, setPayLink] = useState("");
  const [count, setCount] = useState(0);
  const [cents, setCents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/dunning-settings")
      .then((r) => r.json())
      .then((d) => {
        setEnabled(!!d.enabled); setPayLink(d.payLink || "");
        setCount(d.outstandingCount || 0); setCents(d.outstandingCents || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async (next: { enabled?: boolean; payLink?: string }) => {
    setSaving(true); setSaved(false);
    try {
      await fetch("/api/admin/dunning-settings", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next),
      });
      setSaved(true); setTimeout(() => setSaved(false), 1500);
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const toggle = () => { const v = !enabled; setEnabled(v); void save({ enabled: v }); };

  return (
    <div className="dgs-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-5 h-5 text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-navy-900">Failed-payment recovery</p>
            <p className="text-[12px] text-gray-500">Texts a customer when their card declines, before the subscription lapses.</p>
          </div>
        </div>
        <button
          role="switch" aria-checked={enabled} onClick={toggle} disabled={loading || saving}
          className="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-50"
          style={{ background: enabled ? "#16A34A" : "#D1D5DB" }}
        >
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${enabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[12.5px]">
        <span className={count > 0 ? "text-amber-800 font-semibold" : "text-gray-500"}>
          {loading ? "Checking…" : count > 0 ? `${count} unpaid invoice${count === 1 ? "" : "s"} · ${money(cents)} outstanding` : "No outstanding balances"}
        </span>
      </div>

      {!enabled && !loading && (
        <p className="mt-2 text-[11.5px] text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
          Off — you&apos;ll still get an alert when a payment fails, but no customer is contacted. Turn it on to have declines chased automatically (day 0, day 3, day 7, then it stops).
        </p>
      )}

      {enabled && (
        <div className="mt-3">
          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Payment / update-card link (optional)</label>
          <input
            value={payLink}
            onChange={(e) => setPayLink(e.target.value)}
            onBlur={() => save({ payLink })}
            placeholder="https://…  (your Sweep&Go client portal)"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/30 focus:border-transparent"
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-gray-400">Included in the text. Leave blank and it asks them to reply instead.</p>
            {saving ? <span className="text-[11px] text-gray-400 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving</span>
              : saved ? <span className="text-[11px] text-green-600 inline-flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span> : null}
          </div>
          <p className="mt-2 text-[11.5px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 inline-flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>Live — customers with a declined card will be texted automatically during your sending hours.</span>
          </p>
        </div>
      )}
    </div>
  );
}
