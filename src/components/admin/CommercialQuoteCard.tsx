"use client";

import { useCallback, useState } from "react";
import { Calculator, Check, Loader2 } from "lucide-react";
import { CommunityQuoteCalculator, type Fields } from "@/components/admin/CommunityQuoteCalculator";

/**
 * The Community Quote calculator, attached to a commercial lead. Prefills the
 * property and contact from the lead, reopens a saved quote exactly as it was
 * left, and saves the full field record back to the lead. The PDF agreement
 * inside the calculator draws from the same fields.
 */
export function CommercialQuoteCard({
  leadId, initial, savedAt, mapboxToken,
}: {
  leadId: string;
  initial: Partial<Fields> | null;
  savedAt: string | null;
  mapboxToken?: string;
}) {
  const [fields, setFields] = useState<Fields | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(savedAt);
  const [error, setError] = useState<string | null>(null);
  const onChange = useCallback((f: Fields) => setFields(f), []);

  async function save() {
    if (!fields) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/commercial-leads/${leadId}/quote`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error || "Could not save"); return; }
      setSaved(data.savedAt);
    } catch { setError("Could not save"); } finally { setBusy(false); }
  }

  return (
    <div className="dgs-card p-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-lg font-semibold text-navy-900">
          <Calculator className="w-5 h-5 inline-block mr-2" />
          Community Quote
        </h2>
        <div className="flex items-center gap-3">
          {saved && !busy && (
            <span className="text-xs text-gray-500">
              Saved {new Date(saved).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          )}
          <button
            type="button" onClick={save} disabled={busy || !fields}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {busy ? "Saving..." : "Save quote to lead"}
          </button>
        </div>
      </div>
      {error && <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      <p className="text-sm text-gray-500 mb-4">
        Price the property by area and frequency. Property and contact are filled in from the lead; measure the common area on the map, then save so the quote stays with this lead.
      </p>
      <CommunityQuoteCalculator mapboxToken={mapboxToken} initial={initial || undefined} onChange={onChange} />
    </div>
  );
}
