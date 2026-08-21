"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Sparkles, UserPlus, Map as MapIcon, Loader2, Navigation } from "lucide-react";
import { enqueue } from "@/lib/pwa/canvasser-outbox";

export interface PinData {
  id: string;
  clientKey: string;
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
  zipCode: string | null;
  status: string;
  notes: string | null;
  aiNotes: string | null;
  canvasserLeadId: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS: { id: string; label: string; color: string }[] = [
  { id: "NOT_HOME", label: "Not home", color: "#9CA3AF" },
  { id: "CALLBACK", label: "Call back", color: "#F59E0B" },
  { id: "INTERESTED", label: "Interested", color: "#2563EB" },
  { id: "NOT_INTERESTED", label: "Not interested", color: "#EF4444" },
  { id: "LEAD", label: "Lead", color: "#16A34A" },
  { id: "DO_NOT_KNOCK", label: "Do not knock", color: "#111827" },
];
const uuid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ck_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export function PinDetail({ pin }: { pin: PinData }) {
  const [status, setStatus] = useState(pin.status);
  const [notes, setNotes] = useState(pin.notes ?? "");
  const [address, setAddress] = useState(pin.address ?? "");
  const [leadId, setLeadId] = useState(pin.canvasserLeadId);
  const [leadForm, setLeadForm] = useState<{ firstName: string; lastName: string; phone: string; email: string } | null>(null);
  const [savingLead, setSavingLead] = useState(false);

  // Every save sends the full current state through the offline outbox (upsert
  // by clientKey), matching how the map saves — so it's offline-safe.
  const save = (next: { status?: string; notes?: string; address?: string }) => {
    void enqueue("visit", {
      clientKey: pin.clientKey, lat: pin.lat, lng: pin.lng,
      status: next.status ?? status,
      notes: next.notes ?? notes,
      address: (next.address ?? address) || null,
      city: pin.city, zipCode: pin.zipCode,
    });
  };

  const markLead = async () => {
    if (!leadForm) return;
    setSavingLead(true);
    await enqueue("lead", {
      clientKey: uuid(), visitClientKey: pin.clientKey,
      firstName: leadForm.firstName, lastName: leadForm.lastName, phone: leadForm.phone, email: leadForm.email,
      address, city: pin.city, zipCode: pin.zipCode, notes, aiNotes: pin.aiNotes,
    });
    save({ status: "LEAD" });
    setStatus("LEAD");
    setLeadId("pending");
    setSavingLead(false);
    setLeadForm(null);
  };

  const gmaps = `https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}`;

  return (
    <div className="space-y-3">
      <Link href="/app/canvasser/list" className="inline-flex items-center gap-1 text-[13px] text-gray-500 font-semibold"><ArrowLeft className="w-4 h-4" /> All pins</Link>

      {/* Address + location */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <label className="block text-[11px] font-semibold text-gray-400 mb-1">Address</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onBlur={(e) => { if (e.target.value.trim() !== (pin.address ?? "")) save({ address: e.target.value.trim() }); }}
          placeholder="Add an address"
          className="w-full text-[15px] font-bold text-gray-900 bg-transparent border-b border-transparent focus:border-violet-300 focus:outline-none py-0.5"
        />
        <p className="text-[12px] text-gray-500 mt-1">{[pin.city, pin.zipCode].filter(Boolean).join(", ") || `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`}</p>
        <div className="flex gap-2 mt-3">
          <Link href={`/app/canvasser?pin=${pin.clientKey}`} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12.5px] font-bold text-white" style={{ background: "#6D3EF0" }}><MapIcon className="w-4 h-4" /> Open on map</Link>
          <a href={gmaps} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12.5px] font-semibold text-gray-600 border border-gray-200"><Navigation className="w-4 h-4" /> Directions</a>
        </div>
      </div>

      {/* Status */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <label className="block text-[11px] font-semibold text-gray-400 mb-2">Status</label>
        <div className="flex flex-wrap gap-1.5">
          {STATUS.map((s) => (
            <button key={s.id} onClick={() => { setStatus(s.id); save({ status: s.id }); }}
              className="px-2.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors"
              style={status === s.id ? { background: s.color, color: "#fff", borderColor: s.color } : { color: s.color, borderColor: "#E5E7EB" }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <label className="block text-[11px] font-semibold text-gray-400 mb-1.5">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={(e) => { if (e.target.value !== (pin.notes ?? "")) save({ notes: e.target.value }); }}
          placeholder="Notes about this home…"
          rows={4}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
        />
      </div>

      {/* AI notes */}
      {pin.aiNotes && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-[11px] font-bold text-violet-700 uppercase tracking-wide flex items-center gap-1.5 mb-1.5"><Sparkles className="w-3.5 h-3.5" /> AI notes from the door</p>
          <p className="text-[13px] text-gray-700 whitespace-pre-wrap leading-relaxed">{pin.aiNotes}</p>
        </div>
      )}

      {/* Lead */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        {leadId ? (
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold text-green-700 flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> Marked as a lead</p>
            <Link href="/app/canvasser/my-leads" className="text-[12.5px] font-semibold text-violet-600">View leads →</Link>
          </div>
        ) : leadForm ? (
          <div className="space-y-2">
            <p className="text-[12px] font-semibold text-gray-500">Mark this home as a lead</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={leadForm.firstName} onChange={(e) => setLeadForm({ ...leadForm, firstName: e.target.value })} placeholder="First name" className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              <input value={leadForm.lastName} onChange={(e) => setLeadForm({ ...leadForm, lastName: e.target.value })} placeholder="Last name" className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
            <input value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} placeholder="Phone" inputMode="tel" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            <input value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} placeholder="Email (optional)" inputMode="email" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            <button onClick={markLead} disabled={savingLead} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-60" style={{ background: "#16A34A" }}>
              {savingLead ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Save lead
            </button>
          </div>
        ) : (
          <button onClick={() => setLeadForm({ firstName: "", lastName: "", phone: "", email: "" })} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white" style={{ background: "#6D3EF0" }}>
            <UserPlus className="w-4 h-4" /> Mark as lead
          </button>
        )}
      </div>

      <p className="text-[11px] text-gray-400 px-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Added {fmt(pin.createdAt)}{pin.updatedAt !== pin.createdAt ? ` · updated ${fmt(pin.updatedAt)}` : ""}</p>
    </div>
  );
}
