"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { LeadStatus } from "@/types/leads";

const STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "PHONE_REVIEW", label: "Phone Review" },
  { value: "NO_ANSWER", label: "No Answer" },
  { value: "WAITING_FOR_SIGNUP", label: "Waiting for Signup" },
  { value: "NOT_INTERESTED", label: "Not Interested" },
  { value: "CONVERTED", label: "Converted" },
];

const input = "w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm";
const label = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1";

export function CommercialLeadForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    contactName: "", propertyName: "", phone: "", email: "",
    city: "", state: "CA", zipCode: "", status: "NEW" as LeadStatus, inquiry: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/admin/create-commercial-lead", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error || "Could not save the lead"); return; }
      router.push(`/admin/leads/commercial/${data.id}`);
    } catch {
      setError("Could not save the lead");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="dgs-card p-6 space-y-5 max-w-3xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className={label}>Property or business *</label><input className={input} value={f.propertyName} onChange={set("propertyName")} required placeholder="e.g. Sierra Lakes HOA" /></div>
        <div><label className={label}>Contact name *</label><input className={input} value={f.contactName} onChange={set("contactName")} required /></div>
        <div><label className={label}>Phone *</label><input className={input} type="tel" value={f.phone} onChange={set("phone")} required /></div>
        <div><label className={label}>Email</label><input className={input} type="email" value={f.email} onChange={set("email")} /></div>
        <div><label className={label}>City *</label><input className={input} value={f.city} onChange={set("city")} required /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={label}>State</label><input className={input} value={f.state} onChange={set("state")} maxLength={2} /></div>
          <div><label className={label}>ZIP *</label><input className={input} value={f.zipCode} onChange={set("zipCode")} required inputMode="numeric" /></div>
        </div>
        <div><label className={label}>Status</label>
          <select className={input} value={f.status} onChange={set("status")}>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        </div>
      </div>
      <div><label className={label}>Notes / what they asked for</label>
        <textarea className={input} rows={4} value={f.inquiry} onChange={set("inquiry")} placeholder="Units, common areas, how often, who referred them…" />
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-sm font-bold text-white disabled:opacity-60" style={{ background: "#8B6BFF" }}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save commercial lead
        </button>
        <button type="button" onClick={() => router.back()} className="text-sm font-semibold text-gray-500 hover:text-gray-800">Cancel</button>
      </div>
    </form>
  );
}
