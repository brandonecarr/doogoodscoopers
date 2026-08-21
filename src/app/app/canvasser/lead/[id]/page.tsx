import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCanvasserSession } from "@/lib/canvasser-auth";
import prisma from "@/lib/prisma";
import { ArrowLeft, Phone, MessageSquare, Mail, MapPin, Sparkles, Navigation, Map as MapIcon } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  NEW: "New", CONTACTED: "Contacted", NO_ANSWER: "No answer",
  NOT_INTERESTED: "Not interested", WAITING_FOR_SIGNUP: "Waiting", CONVERTED: "Signed up", PHONE_REVIEW: "Review",
};
const fmt = (d: Date) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCanvasserSession();
  if (!session) redirect("/canvasser/login");
  const { id } = await params;

  const lead = await prisma.canvasserLead.findUnique({ where: { id } });
  if (!lead || lead.canvasserId !== session.id) notFound();

  // The pin this lead came from (so the rep can jump back to it on the map).
  const pin = await prisma.canvassVisit.findFirst({
    where: { canvasserLeadId: lead.id, canvasserId: session.id },
    select: { id: true, lat: true, lng: true },
  });

  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unnamed lead";
  const loc = [lead.address, lead.city, lead.zipCode].filter(Boolean).join(", ");
  const gmaps = pin ? `https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}` : loc ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}` : null;

  return (
    <div className="space-y-3">
      <Link href="/app/canvasser/my-leads" className="inline-flex items-center gap-1 text-[13px] text-gray-500 font-semibold"><ArrowLeft className="w-4 h-4" /> My Leads</Link>

      {/* Header */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-[17px] font-extrabold text-gray-900">{name}</h1>
          <span className="text-[10.5px] font-semibold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5 flex-shrink-0">{STATUS_LABEL[lead.status] ?? lead.status}</span>
        </div>
        {loc && <p className="text-[12.5px] text-gray-600 mt-1">{loc}</p>}

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <a href={lead.phone ? `tel:${lead.phone}` : undefined} aria-disabled={!lead.phone} className={`inline-flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11.5px] font-bold ${lead.phone ? "text-white" : "text-gray-300 pointer-events-none bg-gray-100"}`} style={lead.phone ? { background: "#16A34A" } : undefined}><Phone className="w-4 h-4" /> Call</a>
          <a href={lead.phone ? `sms:${lead.phone}` : undefined} aria-disabled={!lead.phone} className={`inline-flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11.5px] font-bold ${lead.phone ? "text-white" : "text-gray-300 pointer-events-none bg-gray-100"}`} style={lead.phone ? { background: "#2563EB" } : undefined}><MessageSquare className="w-4 h-4" /> Text</a>
          <a href={lead.email ? `mailto:${lead.email}` : undefined} aria-disabled={!lead.email} className={`inline-flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11.5px] font-bold ${lead.email ? "text-white" : "text-gray-300 pointer-events-none bg-gray-100"}`} style={lead.email ? { background: "#6D3EF0" } : undefined}><Mail className="w-4 h-4" /> Email</a>
        </div>
      </div>

      {/* Contact details */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2">
        <Row label="Phone" value={lead.phone ? <a href={`tel:${lead.phone}`} className="text-violet-600">{lead.phone}</a> : "—"} />
        <Row label="Email" value={lead.email ? <a href={`mailto:${lead.email}`} className="text-violet-600 break-all">{lead.email}</a> : "—"} />
        <Row label="Address" value={loc || "—"} />
        {lead.grade && <Row label="Grade" value={lead.grade} />}
        {lead.followupDate && <Row label="Follow up" value={fmt(lead.followupDate)} />}
      </div>

      {/* Notes */}
      {lead.notes && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Notes</p>
          <p className="text-[13px] text-gray-700 whitespace-pre-wrap leading-relaxed">{lead.notes}</p>
        </div>
      )}

      {/* AI notes */}
      {lead.aiNotes && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-[11px] font-bold text-violet-700 uppercase tracking-wide flex items-center gap-1.5 mb-1.5"><Sparkles className="w-3.5 h-3.5" /> AI notes from the door</p>
          <p className="text-[13px] text-gray-700 whitespace-pre-wrap leading-relaxed">{lead.aiNotes}</p>
        </div>
      )}

      {/* Map links */}
      {(pin || gmaps) && (
        <div className="flex gap-2">
          {pin && <Link href={`/app/canvasser/pin/${pin.id}`} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[12.5px] font-bold text-white" style={{ background: "#6D3EF0" }}><MapIcon className="w-4 h-4" /> View the pin</Link>}
          {gmaps && <a href={gmaps} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[12.5px] font-semibold text-gray-600 border border-gray-200"><Navigation className="w-4 h-4" /> Directions</a>}
        </div>
      )}

      <p className="text-[11px] text-gray-400 px-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Added {fmt(lead.createdAt)}{lead.canvasserName ? ` · ${lead.canvasserName}` : ""}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12px] font-semibold text-gray-400">{label}</span>
      <span className="text-[13px] text-gray-800 text-right">{value}</span>
    </div>
  );
}
