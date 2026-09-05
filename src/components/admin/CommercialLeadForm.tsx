"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

const input = "w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent";
const label = "block text-sm font-medium text-gray-700 mb-1";

export interface EditableCommercialLead {
  id: string; contactName: string; propertyName: string; phone: string; email: string;
  city: string; state: string; zipCode: string; status: LeadStatus; inquiry: string | null;
}

export function CommercialLeadForm({ lead, mode = "create" }: { lead?: EditableCommercialLead; mode?: "create" | "edit" }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    contactName: lead?.contactName || "", propertyName: lead?.propertyName || "", phone: lead?.phone || "", email: lead?.email || "",
    city: lead?.city || "", state: lead?.state || "CA", zipCode: lead?.zipCode || "",
    status: (lead?.status || "NEW") as LeadStatus, inquiry: lead?.inquiry || "",
  });
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true); setError(null);
    try {
      const res = await fetch(
        mode === "edit" && lead ? `/api/admin/commercial-leads/${lead.id}` : "/api/admin/create-commercial-lead",
        { method: mode === "edit" ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || (mode === "edit" ? "Failed to save changes" : "Failed to create lead"));
      router.push(`/admin/leads/commercial/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}

      {/* Contact Information */}
      <div className="dgs-card p-6">
        <h2 className="text-lg font-semibold text-navy-900 mb-4">Contact Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Contact Name *</label>
            <input type="text" name="contactName" value={formData.contactName} onChange={handleChange} required className={input} />
          </div>
          <div>
            <label className={label}>Phone *</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className={input} />
          </div>
        </div>
      </div>

      {/* Property Information */}
      <div className="dgs-card p-6">
        <h2 className="text-lg font-semibold text-navy-900 mb-4">Property Information</h2>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className={label}>Property / Business Name *</label>
            <input type="text" name="propertyName" value={formData.propertyName} onChange={handleChange} required className={input} placeholder="e.g. Sierra Lakes HOA" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={label}>City *</label>
              <input type="text" name="city" value={formData.city} onChange={handleChange} required className={input} />
            </div>
            <div>
              <label className={label}>State</label>
              <input type="text" name="state" value={formData.state} onChange={handleChange} maxLength={2} className={input} />
            </div>
            <div>
              <label className={label}>ZIP Code *</label>
              <input type="text" name="zipCode" value={formData.zipCode} onChange={handleChange} required inputMode="numeric" className={input} />
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="dgs-card p-6">
        <h2 className="text-lg font-semibold text-navy-900 mb-4">Details</h2>
        <div className="grid grid-cols-1 gap-4">
          <div className="sm:w-1/2">
            <label className={label}>Status</label>
            <select name="status" value={formData.status} onChange={handleChange} className={input}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Notes / What they asked for</label>
            <textarea name="inquiry" rows={4} value={formData.inquiry} onChange={handleChange} className={input} placeholder="Units, common areas, how often, who referred them…" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-4">
        <button type="button" onClick={() => router.back()} className="px-6 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {isSubmitting ? "Saving..." : mode === "create" ? "Create Lead" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
