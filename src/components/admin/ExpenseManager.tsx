"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Repeat, Receipt } from "lucide-react";

interface Expense {
  id: string;
  kind: string;
  category: string;
  label: string;
  vendor: string | null;
  amountCents: number;
  occurredOn: string | null;
  startedOn: string | null;
  endedOn: string | null;
}

const money = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6D3EF0]/30 focus:border-transparent";

export function ExpenseManager({ categories }: { categories: { key: string; label: string }[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [kind, setKind] = useState<"recurring" | "onetime">("recurring");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("other");
  const [when, setWhen] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/admin/expenses")
      .then((r) => r.json())
      .then((d) => setItems(d.expenses ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const add = async () => {
    setError("");
    if (!label.trim()) return setError("Give the expense a name.");
    if (!(parseFloat(amount.replace(/[$,]/g, "")) > 0)) return setError("Enter an amount above zero.");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind, label, amount, category,
          ...(kind === "onetime" ? { occurredOn: when || undefined } : { startedOn: when || undefined }),
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Could not save."); return; }
      setLabel(""); setAmount(""); setWhen("");
      load();
      router.refresh(); // recompute the P&L above
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    await fetch(`/api/admin/expenses?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setItems((x) => x.filter((i) => i.id !== id));
    router.refresh();
  };

  const recurring = items.filter((i) => i.kind === "recurring");
  const onetime = items.filter((i) => i.kind === "onetime");
  const overhead = recurring.reduce((n, i) => n + i.amountCents, 0);

  return (
    <div className="dgs-card p-5">
      <h2 className="text-lg font-semibold text-navy-900 mb-1">Expenses</h2>
      <p className="text-[12.5px] text-gray-500 mb-4">
        <b>Monthly overhead</b> repeats every month until you end it. <b>One-time</b> lands in the month it happened.
      </p>

      {/* Add */}
      <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 space-y-2.5">
        <div className="flex gap-2">
          <button type="button" onClick={() => setKind("recurring")}
            className="flex-1 px-3 py-2 rounded-lg text-[13px] font-semibold border inline-flex items-center justify-center gap-1.5"
            style={kind === "recurring" ? { background: "#EFE9FF", color: "#6D3EF0", borderColor: "#6D3EF0" } : { color: "#6B7280", borderColor: "#E5E7EB", background: "#fff" }}>
            <Repeat className="w-4 h-4" /> Monthly overhead
          </button>
          <button type="button" onClick={() => setKind("onetime")}
            className="flex-1 px-3 py-2 rounded-lg text-[13px] font-semibold border inline-flex items-center justify-center gap-1.5"
            style={kind === "onetime" ? { background: "#EFE9FF", color: "#6D3EF0", borderColor: "#6D3EF0" } : { color: "#6B7280", borderColor: "#E5E7EB", background: "#fff" }}>
            <Receipt className="w-4 h-4" /> One-time cost
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What is it? e.g. Truck insurance" className={inputCls} />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal"
            placeholder={kind === "recurring" ? "Amount per month" : "Amount"} className={inputCls} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <input type="date" value={when} onChange={(e) => setWhen(e.target.value)} className={inputCls}
            title={kind === "recurring" ? "Started on (optional)" : "Date of the cost"} />
        </div>

        {error && <p className="text-[12px] text-red-600">{error}</p>}

        <button type="button" onClick={add} disabled={saving}
          className="w-full px-3 py-2 rounded-lg text-white text-[13px] font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          style={{ background: "#6D3EF0" }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add expense
        </button>
      </div>

      {/* Lists */}
      {loading ? (
        <p className="text-[13px] text-gray-500 mt-4">Loading…</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <h3 className="text-[13px] font-bold text-navy-900">Monthly overhead</h3>
              <span className="text-[13px] font-semibold text-navy-900">{money(overhead)}/mo</span>
            </div>
            {recurring.length === 0 ? (
              <p className="text-[12.5px] text-gray-500">Nothing yet — add insurance, software, phone, storage…</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {recurring.map((i) => (
                  <li key={i.id} className="flex items-center justify-between py-2 text-[13px]">
                    <span className="min-w-0">
                      <span className="text-navy-900 font-medium">{i.label}</span>
                      <span className="text-gray-400"> · {categories.find((c) => c.key === i.category)?.label ?? i.category}</span>
                      {i.endedOn && <span className="text-amber-700"> · ended</span>}
                    </span>
                    <span className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-semibold text-navy-900">{money(i.amountCents)}</span>
                      <button onClick={() => remove(i.id)} className="text-gray-400 hover:text-red-600" aria-label={`Remove ${i.label}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {onetime.length > 0 && (
            <div>
              <h3 className="text-[13px] font-bold text-navy-900 mb-1.5">One-time costs</h3>
              <ul className="divide-y divide-gray-100">
                {onetime.map((i) => (
                  <li key={i.id} className="flex items-center justify-between py-2 text-[13px]">
                    <span className="min-w-0">
                      <span className="text-navy-900 font-medium">{i.label}</span>
                      <span className="text-gray-400">
                        {" · "}{i.occurredOn ? new Date(i.occurredOn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </span>
                    </span>
                    <span className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-semibold text-navy-900">{money(i.amountCents)}</span>
                      <button onClick={() => remove(i.id)} className="text-gray-400 hover:text-red-600" aria-label={`Remove ${i.label}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
