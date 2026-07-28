"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Wallet, Loader2, Plus, Check } from "lucide-react";

interface Balance {
  amount: number;
  lowThreshold: number;
  costPerSegment: number;
}

const QUICK = [10, 20, 50];

// Locally-tracked Quo messaging balance. Quo has no billing API, so this is an
// estimate maintained by decrementing on each send — the panel lets you re-sync
// it to whatever Quo actually shows.
export function SmsBalanceChip() {
  const [bal, setBal] = useState<Balance | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addAmt, setAddAmt] = useState("");
  const [setAmt, setSetAmt] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/sms-balance");
      if (r.ok) setBal(await r.json());
    } catch {
      /* retry next tick */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled) void load();
    };
    const first = setTimeout(tick, 0);
    const repeat = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(repeat);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/sms-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setBal(await r.json());
        setAddAmt("");
        setSetAmt("");
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!bal) return null;

  const empty = bal.amount <= 0;
  const low = !empty && bal.amount <= bal.lowThreshold;
  const tone = empty
    ? "bg-red-50 text-red-700 border-red-200"
    : low
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-gray-50 text-navy-900 border-gray-200";
  const remaining = bal.costPerSegment > 0 ? Math.floor(Math.max(bal.amount, 0) / bal.costPerSegment) : 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Quo messaging balance"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm font-medium transition-colors hover:brightness-95 ${tone}`}
      >
        <Wallet className="w-4 h-4" />
        ${bal.amount.toFixed(2)}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-100 z-50 p-4 space-y-3">
          <div>
            <p className="text-xs text-gray-500">Quo messaging balance</p>
            <p className={`text-2xl font-bold ${empty ? "text-red-600" : low ? "text-amber-600" : "text-navy-900"}`}>
              ${bal.amount.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">
              ≈ {remaining.toLocaleString()} more messages at ${bal.costPerSegment.toFixed(3)} each
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-700 mb-1.5">Add funds</p>
            <div className="flex gap-1.5 mb-2">
              {QUICK.map((q) => (
                <button
                  key={q}
                  disabled={busy}
                  onClick={() => post({ addFunds: q })}
                  className="flex-1 px-2 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                >
                  +${q}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                value={addAmt}
                onChange={(e) => setAddAmt(e.target.value)}
                inputMode="decimal"
                placeholder="Other amount"
                className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
              <button
                disabled={busy || !addAmt.trim()}
                onClick={() => post({ addFunds: addAmt })}
                className="px-2.5 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-700 mb-1.5">Correct to match Quo</p>
            <div className="flex gap-1.5">
              <input
                value={setAmt}
                onChange={(e) => setSetAmt(e.target.value)}
                inputMode="decimal"
                placeholder="Exact balance"
                className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
              <button
                disabled={busy || !setAmt.trim()}
                onClick={() => post({ setAmount: setAmt })}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Set
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              This figure is tracked here, not read from Quo. Re-sync it after topping up.
            </p>
          </div>

          <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
            <label className="text-xs text-gray-600">Warn below $</label>
            <input
              defaultValue={bal.lowThreshold}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && Number(v) !== bal.lowThreshold) post({ lowThreshold: v });
              }}
              inputMode="decimal"
              className="w-16 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
            {saved && <Check className="w-4 h-4 text-green-600 ml-auto" />}
          </div>
        </div>
      )}
    </div>
  );
}
