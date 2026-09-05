"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PROSPECT_TYPES, PROSPECT_TYPE_LABEL } from "@/lib/commercial-prospect-types";

export interface EditableProspect {
  id: string; propertyName: string; propertyType: string; contactName: string | null; phone: string | null; email: string | null;
  city: string; state: string; zipCode: string; address: string | null; units: number | null; notes: string | null; source: string | null;
}
const input = "w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent";
const label = "block text-sm font-medium text-gray-700 mb-1";

export function CommercialProspectForm({ prospect, mode = "create" }: { prospect?: EditableProspect; mode?: "create" | "edit" }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    propertyName: prospect?.propertyName || "", propertyType: prospect?.propertyType || "HOA", contactName: prospect?.contactName || "",
    phone: prospect?.phone || "", email: prospect?.email || "", city: prospect?.city || "", state: prospect?.state || "CA", zipCode: prospect?.zipCode || "", address: prospect?.address || "",
    units: prospect?.units ? String(prospect.units) : "", notes: prospect?.notes || "", source: prospect?.source || "",
  });
  const on = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [e.target.name]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setIsSubmitting(true); setError(null);
    try {
      const res = mode === "edit" && prospect
        ? await fetch(`/api/admin/commercial-prospects/${prospect.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "edit", ...f }) })
        : await fetch("/api/admin/commercial-prospects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = await res.json(); if (!res.ok || !d.success) throw new Error(d.error || "Could not save");
      router.push("/admin/leads/commercial/call-list"); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred"); } finally { setIsSubmitting(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-6">
      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}
      <div className="dgs-card p-6">
        <h2 className="text-lg font-semibold text-navy-900 mb-4">Property Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={label}>Property / Community Name *</label><input name="propertyName" value={f.propertyName} onChange={on} required className={input} placeholder="e.g. Sierra Lakes HOA" /></div>
          <div><label className={label}>Type</label><select name="propertyType" value={f.propertyType} onChange={on} className={input}>{PROSPECT_TYPES.map((t) => <option key={t} value={t}>{PROSPECT_TYPE_LABEL[t]}</option>)}</select></div>
          <div className="sm:col-span-2"><label className={label}>Street Address</label><input name="address" value={f.address} onChange={on} className={input} placeholder="18414 Jonathan St" /></div>
          <div><label className={label}>City *</label><input name="city" value={f.city} onChange={on} required className={input} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={label}>State</label><input name="state" value={f.state} onChange={on} maxLength={2} className={input} /></div>
            <div><label className={label}>ZIP Code</label><input name="zipCode" value={f.zipCode} onChange={on} inputMode="numeric" className={input} /></div>
          </div>
          <div><label className={label}>Units / Homes</label><input name="units" value={f.units} onChange={on} inputMode="numeric" className={input} /></div>
          <div><label className={label}>Source</label><input name="source" value={f.source} onChange={on} className={input} placeholder="Where you found it (directory, site, referral)" /></div>
        </div>
      </div>
      <div className="dgs-card p-6">
        <h2 className="text-lg font-semibold text-navy-900 mb-4">Contact Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={label}>Contact Name</label><input name="contactName" value={f.contactName} onChange={on} className={input} placeholder="Board manager, leasing office…" /></div>
          <div><label className={label}>Phone</label><input name="phone" type="tel" value={f.phone} onChange={on} className={input} /></div>
          <div className="sm:col-span-2"><label className={label}>Email</label><input name="email" type="email" value={f.email} onChange={on} className={input} /></div>
        </div>
        <p className="text-xs text-gray-500 mt-3">A phone or email is needed before this can be converted to a lead.</p>
      </div>
      <div className="dgs-card p-6">
        <h2 className="text-lg font-semibold text-navy-900 mb-4">Notes</h2>
        <textarea name="notes" rows={4} value={f.notes} onChange={on} className={input} placeholder="Pet policy, pet stations, who to ask for, best time to call…" />
      </div>
      <div className="flex items-center justify-end gap-4">
        <button type="button" onClick={() => router.back()} className="px-6 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? "Saving..." : mode === "create" ? "Add to Call List" : "Save Changes"}</button>
      </div>
    </form>
  );
}
