import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Mail, Phone, Calendar, User, Sparkles } from "lucide-react";
import prisma from "@/lib/prisma";
import StatusUpdateForm from "@/components/admin/StatusUpdateForm";
import { LeadUpdates } from "@/components/admin/LeadUpdates";
import { LeadMessages } from "@/components/admin/LeadMessages";
import { FollowupGrade } from "@/components/admin/FollowupGrade";
import { LeadActions } from "@/components/admin/LeadActions";
import { LeadQuickActions } from "@/components/admin/LeadQuickActions";
import { isOptedOut } from "@/lib/sms-optout";

export const dynamic = "force-dynamic";

interface PageProps { params: Promise<{ id: string }> }

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default async function CanvasserLeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [lead, updates, messages] = await Promise.all([
    prisma.canvasserLead.findUnique({ where: { id } }),
    prisma.leadUpdate.findMany({ where: { leadId: id, leadType: "CANVASSER" }, orderBy: { createdAt: "desc" } }),
    prisma.leadMessage.findMany({ where: { leadId: id, leadType: "CANVASSER" }, orderBy: { createdAt: "asc" } }),
  ]);

  if (!lead) notFound();

  const optedOut = await isOptedOut(lead.phone);
  const name = `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Canvasser lead";
  const typedUpdates = updates.map((u) => ({
    id: u.id, createdAt: u.createdAt.toISOString(), message: u.message || "",
    communicationType: u.communicationType || "", adminEmail: u.adminEmail || "",
  }));

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header — dark hero */}
      <div className="dgs-hero p-[22px] sm:p-[26px]">
        <div className="flex items-center gap-4">
          <Link href="/admin/leads" className="w-10 h-10 rounded-[10px] bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-[30px] font-extrabold text-white tracking-[-0.03em] leading-none truncate">{name}</h1>
            <p className="text-[#9C9CB0] text-[12.5px] mt-2">Canvasser Lead{lead.canvasserName ? ` · ${lead.canvasserName}` : ""}</p>
          </div>
          <div className="w-12 h-12 rounded-[13px] flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(150deg,#FCD34D,#D97706)" }}>
            <MapPin className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          <div className="dgs-card p-6">
            <h2 className="text-lg font-semibold text-navy-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field icon={<Phone className="w-5 h-5 text-gray-600" />} label="Phone" value={lead.phone ? <a href={`tel:${lead.phone}`} className="hover:text-teal-600">{lead.phone}</a> : null} />
              <Field icon={<Mail className="w-5 h-5 text-gray-600" />} label="Email" value={lead.email ? <a href={`mailto:${lead.email}`} className="hover:text-teal-600">{lead.email}</a> : null} />
              <Field icon={<MapPin className="w-5 h-5 text-gray-600" />} label="Address" value={[lead.address, lead.city, lead.zipCode].filter(Boolean).join(", ") || null} />
              <Field icon={<User className="w-5 h-5 text-gray-600" />} label="Canvasser" value={lead.canvasserName || null} />
              <Field icon={<Calendar className="w-5 h-5 text-gray-600" />} label="Added" value={formatDate(lead.createdAt)} />
            </div>
          </div>

          {lead.aiNotes && (
            <div className="dgs-card p-6">
              <h2 className="text-lg font-semibold text-navy-900 mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-500" /> AI notes from the door
              </h2>
              <p className="text-[13.5px] text-gray-700 whitespace-pre-wrap leading-relaxed">{lead.aiNotes}</p>
              <p className="text-[11px] text-gray-400 mt-3">Captured at the door with the homeowner&apos;s consent. Audio was not recorded.</p>
            </div>
          )}

          <LeadMessages
            leadId={lead.id}
            leadType="canvasser"
            phone={lead.phone}
            optedOut={optedOut}
            initialMessages={messages.map((m) => ({
              id: m.id, createdAt: m.createdAt.toISOString(), direction: m.direction,
              body: m.body, status: m.status, adminEmail: m.adminEmail,
            }))}
          />

          <LeadUpdates leadId={lead.id} leadType="canvasser" updates={typedUpdates} />
        </div>

        {/* Side */}
        <div className="space-y-6">
          <StatusUpdateForm leadId={lead.id} leadType="canvasser" currentStatus={lead.status} notes={lead.notes} />
          <FollowupGrade leadId={lead.id} leadType="canvasser" currentFollowupDate={lead.followupDate?.toISOString()} currentGrade={lead.grade} />
          <LeadQuickActions phone={lead.phone} email={lead.email} firstName={lead.firstName} lastName={lead.lastName} zipCode={lead.zipCode} numberOfDogs={null} />
          <LeadActions leadId={lead.id} leadType="canvasser" isArchived={lead.archived} />
        </div>
      </div>
    </div>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode | null }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="font-medium text-navy-900">{value ?? <span className="text-gray-400">Not provided</span>}</p>
      </div>
    </div>
  );
}
