import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, MapPin, Calendar, Clock } from "lucide-react";
import prisma from "@/lib/prisma";
import type { LeadStatus } from "@/types/leads";
import StatusUpdateForm from "@/components/admin/StatusUpdateForm";
import { LeadQuickActions } from "@/components/admin/LeadQuickActions";
import { ArrangeableBoard, type ArrangeableCard } from "@/components/admin/ArrangeableBoard";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getOutOfAreaLead(id: string) {
  const lead = await prisma.outOfAreaLead.findUnique({
    where: { id },
  });

  return lead;
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const statusLabels: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  NO_ANSWER: "No Answer",
  NOT_INTERESTED: "Not Interested",
  WAITING_FOR_SIGNUP: "Waiting for Signup",
  CONVERTED: "Converted",
  PHONE_REVIEW: "Phone Review",
};

function getStatusBadge(status: LeadStatus) {
  const styles: Record<LeadStatus, string> = {
    NEW: "bg-teal-100 text-teal-800",
    CONTACTED: "bg-blue-100 text-blue-800",
    NO_ANSWER: "bg-orange-100 text-orange-800",
    NOT_INTERESTED: "bg-gray-100 text-gray-800",
    WAITING_FOR_SIGNUP: "bg-purple-100 text-purple-800",
    CONVERTED: "bg-green-100 text-green-800",
    PHONE_REVIEW: "bg-yellow-100 text-yellow-800",
  };

  return (
    <span className={`px-3 py-1 text-sm font-medium rounded-full ${styles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

export default async function OutOfAreaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const lead = await getOutOfAreaLead(id);

  if (!lead) {
    notFound();
  }

  const cards: ArrangeableCard[] = [
    {
      id: "contact",
      zone: "main",
      node: (
        <div className="dgs-card p-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-4">Contact Information</h2>
          <div className="grid grid-cols-1 @lg:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Phone className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <a href={`tel:${lead.phone}`} className="text-navy-900 hover:text-teal-600">
                  {lead.phone}
                </a>
              </div>
            </div>

            {lead.email && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <a href={`mailto:${lead.email}`} className="text-navy-900 hover:text-teal-600">
                    {lead.email}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "location",
      zone: "main",
      node: (
        <div className="dgs-card p-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-4">Location</h2>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">ZIP Code</p>
              <p className="text-xl font-semibold text-navy-900">{lead.zipCode}</p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-amber-50 rounded-lg">
            <p className="text-sm text-amber-800">
              This lead is outside our current service area. Consider reaching out to discuss
              future expansion or alternative options.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "quick-actions",
      zone: "side",
      node: (
        <LeadQuickActions
          phone={lead.phone}
          email={lead.email}
          firstName={lead.firstName}
          lastName={lead.lastName}
          zipCode={lead.zipCode}
        />
      ),
    },
    {
      id: "status",
      zone: "side",
      node: (
        <StatusUpdateForm
          leadId={lead.id}
          leadType="outofarea"
          currentStatus={lead.status}
          notes={lead.notes}
        />
      ),
    },
    {
      id: "timeline",
      zone: "side",
      node: (
        <div className="dgs-card p-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-4">Timeline</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-teal-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-navy-900">Lead Created</p>
                <p className="text-xs text-gray-500">{formatDate(lead.createdAt)}</p>
              </div>
            </div>

            {lead.updatedAt && lead.updatedAt > lead.createdAt && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-navy-900">Last Updated</p>
                  <p className="text-xs text-gray-500">{formatDate(lead.updatedAt)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header — dark hero */}
      <div className="dgs-hero p-[22px] sm:p-[26px]">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/out-of-area"
            className="p-2 rounded-[10px] bg-white/10 hover:bg-white/15 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-[30px] font-extrabold text-white tracking-[-0.03em] leading-none truncate">
              {lead.firstName} {lead.lastName}
            </h1>
            <p className="text-[#9C9CB0] text-[12.5px] mt-2">Out of Area Lead</p>
          </div>
          {getStatusBadge(lead.status)}
        </div>
      </div>

      <ArrangeableBoard layoutId="outofarea" cards={cards} />
    </div>
  );
}
