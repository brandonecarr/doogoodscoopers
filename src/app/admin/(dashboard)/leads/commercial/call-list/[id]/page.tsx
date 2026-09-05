import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, MapPin, Building2, Calendar, Clock, PhoneCall, StickyNote, Pencil, ArrowRightCircle, Archive, Link2, Hash } from "lucide-react";
import prisma from "@/lib/prisma";
import { ArrangeableBoard, type ArrangeableCard } from "@/components/admin/ArrangeableBoard";
import { ProspectRowActions } from "@/components/admin/ProspectRowActions";
import { PROSPECT_TYPE_LABEL, PROSPECT_STATUSES, PROSPECT_STATUS_META, type ProspectType, type ProspectStatus } from "@/lib/commercial-prospect-types";
import StatusUpdateForm from "@/components/admin/StatusUpdateForm";
import { FollowupGrade } from "@/components/admin/FollowupGrade";
import { LeadUpdates } from "@/components/admin/LeadUpdates";

interface PageProps { params: Promise<{ id: string }> }

const TYPE_BADGE: Record<string, string> = { HOA: "bg-violet-100 text-violet-800", APARTMENTS: "bg-amber-100 text-amber-800", SENIOR_55: "bg-sky-100 text-sky-800", OTHER: "bg-gray-100 text-gray-700" };

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Info page for one researched prospect on the call list. */
export default async function ProspectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const p = await prisma.commercialProspect.findUnique({ where: { id } });
  if (!p) notFound();
  const convertedLead = p.convertedLeadId ? await prisma.commercialLead.findUnique({ where: { id: p.convertedLeadId }, select: { id: true, propertyName: true, status: true } }) : null;
  const updates = await prisma.leadUpdate.findMany({ where: { leadId: id, leadType: "COMMERCIAL_PROSPECT" }, orderBy: { createdAt: "desc" } });
  const statusMeta = PROSPECT_STATUS_META[p.status as ProspectStatus];
  const statusLabel = statusMeta?.label || p.status; const statusStyle = (statusMeta?.badge || "bg-gray-100 text-gray-800") + " border-transparent";
  const typeLabel = PROSPECT_TYPE_LABEL[p.propertyType as ProspectType] || p.propertyType;
  const hasContact = !!(p.phone || p.email);

  const Field = ({ icon, tint, label, children }: { icon: React.ReactNode; tint: string; label: string; children: React.ReactNode }) => (
    <div className="flex items-start gap-3 min-w-0">
      <div className={`w-10 h-10 rounded-lg ${tint} flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <div className="min-w-0"><p className="text-sm text-gray-500">{label}</p><div className="text-navy-900 break-words">{children}</div></div>
    </div>
  );
  const dash = <span className="text-gray-400">—</span>;

  const cards: ArrangeableCard[] = [
    {
      id: "property", zone: "main",
      node: (
        <div className="dgs-card p-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-4">Property Information</h2>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0"><Building2 className="w-6 h-6 text-teal-600" /></div>
            <div className="min-w-0"><p className="text-xl font-semibold text-navy-900 break-words">{p.propertyName}</p><p className="text-sm text-gray-500">{typeLabel}</p></div>
          </div>
          <div className="grid grid-cols-1 @lg:grid-cols-2 gap-4">
            <Field icon={<MapPin className="w-5 h-5 text-amber-600" />} tint="bg-amber-50" label="Address">
              {p.address && <p>{p.address}</p>}<p>{p.city}, {p.state}{p.zipCode ? ` ${p.zipCode}` : ""}</p>
            </Field>
            <Field icon={<Hash className="w-5 h-5 text-indigo-600" />} tint="bg-indigo-50" label="Units / Homes">{p.units ? p.units.toLocaleString() : dash}</Field>
            <Field icon={<Link2 className="w-5 h-5 text-gray-600" />} tint="bg-gray-100" label="Source">
              {p.source ? (/^https?:\/\//i.test(p.source) ? <a href={p.source} target="_blank" rel="noreferrer" className="text-teal-700 hover:underline break-all">{p.source}</a> : p.source) : dash}
            </Field>
          </div>
        </div>
      ),
    },
    {
      id: "contact", zone: "main",
      node: (
        <div className="dgs-card p-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-4">Contact Information</h2>
          {!hasContact && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">No phone or email yet. Add one before converting to a lead.</p>}
          <div className="grid grid-cols-1 @lg:grid-cols-2 gap-4">
            <Field icon={<span className="text-lg font-semibold text-gray-600">{(p.contactName || "?").charAt(0).toUpperCase()}</span>} tint="bg-gray-100" label="Contact">{p.contactName || dash}</Field>
            <Field icon={<Phone className="w-5 h-5 text-blue-600" />} tint="bg-blue-50" label="Phone">{p.phone ? <a href={`tel:${p.phone.replace(/\D/g, "")}`} className="hover:text-teal-600">{p.phone}</a> : dash}</Field>
            <div className="@lg:col-span-2"><Field icon={<Mail className="w-5 h-5 text-purple-600" />} tint="bg-purple-50" label="Email">{p.email ? <a href={`mailto:${p.email}`} className="hover:text-teal-600 break-all">{p.email}</a> : dash}</Field></div>
          </div>
        </div>
      ),
    },
    ...(p.notes ? [{
      id: "notes", zone: "main" as const,
      node: (
        <div className="dgs-card p-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-4"><StickyNote className="w-5 h-5 inline-block mr-2" />Research Notes</h2>
          <div className="p-4 bg-gray-50 rounded-lg"><p className="text-navy-900 whitespace-pre-wrap break-words">{p.notes}</p></div>
          <p className="text-xs text-gray-400 mt-2">Call attempts and archive reasons are appended here as you log them.</p>
        </div>
      ),
    }] : []),
    {
      id: "updates", zone: "main",
      node: <LeadUpdates leadId={p.id} leadType="prospect" updates={updates.map((u) => ({ id: u.id, createdAt: u.createdAt.toISOString(), message: u.message, communicationType: u.communicationType, adminEmail: u.adminEmail }))} />,
    },
    {
      id: "status", zone: "side",
      node: (
        <StatusUpdateForm
          leadId={p.id}
          leadType="prospect"
          currentStatus={p.status}
          notes={p.notes}
          submitLabel="Update Prospect"
          options={PROSPECT_STATUSES.map((st) => ({ value: st, label: PROSPECT_STATUS_META[st].label, color: PROSPECT_STATUS_META[st].dot }))}
        />
      ),
    },
    {
      id: "followup", zone: "side",
      node: <FollowupGrade leadId={p.id} leadType="prospect" currentFollowupDate={p.followupDate?.toISOString()} currentGrade={p.grade} />,
    },
    {
      id: "actions", zone: "side",
      node: (
        <div className="dgs-card p-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-1">Actions</h2>
          <p className="text-xs text-gray-500 mb-4">
            {p.status === "CONVERTED" ? "This prospect became a commercial lead." : p.status === "ARCHIVED" ? "Archived. Restore it to put it back on the call list." : "Log each call attempt. Convert once you reach a decision-maker, or archive if it's a dead end."}
          </p>
          <ProspectRowActions id={p.id} status={p.status} hasContact={hasContact} />
          {convertedLead && (
            <Link href={`/admin/leads/commercial/${convertedLead.id}`} className="mt-4 flex items-center gap-2 p-3 rounded-lg border border-green-200 bg-green-50 text-green-800 hover:bg-green-100 transition-colors">
              <ArrowRightCircle className="w-4 h-4 flex-shrink-0" /><span className="text-sm font-medium truncate">Open lead: {convertedLead.propertyName}</span>
            </Link>
          )}
        </div>
      ),
    },
    {
      id: "calls", zone: "side",
      node: (
        <div className="dgs-card p-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-4">Call Activity</h2>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0"><PhoneCall className="w-6 h-6 text-blue-600" /></div>
            <div><p className="text-2xl font-bold text-navy-900 leading-none">{p.attempts}</p><p className="text-sm text-gray-500 mt-1">call attempt{p.attempts === 1 ? "" : "s"}</p></div>
          </div>
          <p className="text-sm text-gray-500 mt-4">Last attempt: <span className="text-navy-900">{p.lastAttemptAt ? formatDate(p.lastAttemptAt) : "none yet"}</span></p>
        </div>
      ),
    },
    {
      id: "timeline", zone: "side",
      node: (
        <div className="dgs-card p-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-4">Timeline</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3"><div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0"><Calendar className="w-4 h-4 text-teal-600" /></div><div><p className="text-sm font-medium text-navy-900">Added to call list</p><p className="text-xs text-gray-500">{formatDate(p.createdAt)}</p></div></div>
            {p.lastAttemptAt && <div className="flex items-start gap-3"><div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0"><PhoneCall className="w-4 h-4 text-blue-600" /></div><div><p className="text-sm font-medium text-navy-900">Last call attempt</p><p className="text-xs text-gray-500">{formatDate(p.lastAttemptAt)}</p></div></div>}
            {p.followupDate && <div className="flex items-start gap-3"><div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${p.followupDate < new Date() ? "bg-red-100" : "bg-teal-100"}`}><Calendar className={`w-4 h-4 ${p.followupDate < new Date() ? "text-red-600" : "text-teal-600"}`} /></div><div><p className="text-sm font-medium text-navy-900">{p.followupDate < new Date() ? "Follow-up overdue" : "Follow-up scheduled"}</p><p className="text-xs text-gray-500">{formatDate(p.followupDate)}</p></div></div>}
            {p.archivedAt && <div className="flex items-start gap-3"><div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"><Archive className="w-4 h-4 text-gray-600" /></div><div><p className="text-sm font-medium text-navy-900">Archived</p><p className="text-xs text-gray-500">{formatDate(p.archivedAt)}</p></div></div>}
            {p.status === "CONVERTED" && <div className="flex items-start gap-3"><div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><ArrowRightCircle className="w-4 h-4 text-green-600" /></div><div><p className="text-sm font-medium text-navy-900">Converted to lead</p><p className="text-xs text-gray-500">{formatDate(p.updatedAt)}</p></div></div>}
            {p.updatedAt > p.createdAt && <div className="flex items-start gap-3"><div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"><Clock className="w-4 h-4 text-gray-600" /></div><div><p className="text-sm font-medium text-navy-900">Last updated</p><p className="text-xs text-gray-500">{formatDate(p.updatedAt)}</p></div></div>}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="dgs-hero p-[22px] sm:p-[26px]">
        <div className="flex items-center gap-4">
          <Link href="/admin/leads/commercial/call-list" className="p-2 rounded-[10px] bg-white/10 hover:bg-white/15 transition-colors flex-shrink-0"><ArrowLeft className="w-5 h-5 text-white" /></Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-[30px] font-extrabold text-white tracking-[-0.03em] leading-none truncate">{p.propertyName}</h1>
            <p className="text-[#9C9CB0] text-[12.5px] mt-2">Call list prospect · {p.city}, {p.state}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            {p.grade && <span className="px-3 py-1 text-sm font-bold rounded-full border border-white/20 bg-white/10 text-white whitespace-nowrap">Grade: {p.grade}</span>}
            <span className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${TYPE_BADGE[p.propertyType] || TYPE_BADGE.OTHER}`}>{typeLabel}</span>
            <span className={`px-3 py-1 text-sm font-medium rounded-full border whitespace-nowrap ${statusStyle}`}>{statusLabel}</span>
          </div>
        </div>
      </div>

      <ArrangeableBoard layoutId="call-list-prospect" cards={cards} actions={
        p.status !== "CONVERTED" ? (
          <Link href={`/admin/leads/commercial/call-list/${p.id}/edit`} className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors text-sm font-medium flex-shrink-0"><Pencil className="w-3.5 h-3.5" />Edit</Link>
        ) : undefined
      } />
    </div>
  );
}
