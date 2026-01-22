import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, MapPin, Building2, Calendar, Clock, MessageSquare } from "lucide-react";
import prisma from "@/lib/prisma";
import type { LeadStatus } from "@/types/leads";
import StatusUpdateForm from "@/components/admin/StatusUpdateForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getCommercialLead(id: string) {
  const lead = await prisma.commercialLead.findUnique({
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

function getStatusBadge(status: LeadStatus) {
  const styles: Record<LeadStatus, string> = {
    NEW: "bg-teal-100 text-teal-800",
    CONTACTED: "bg-blue-100 text-blue-800",
    QUALIFIED: "bg-purple-100 text-purple-800",
    CONVERTED: "bg-green-100 text-green-800",
    LOST: "bg-gray-100 text-gray-800",
  };

  return (
    <span className={`px-3 py-1 text-sm font-medium rounded-full ${styles[status]}`}>
      {status}
    </span>
  );
}

export default async function CommercialDetailPage({ params }: PageProps) {
  const { id } = await params;
  const lead = await getCommercialLead(id);

  if (!lead) {
    notFound();
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/commercial"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-navy-900">{lead.propertyName}</h1>
          <p className="text-navy-600 mt-1">Commercial Inquiry</p>
        </div>
        {getStatusBadge(lead.status)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Property Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-navy-900 mb-4">Property Information</h2>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-teal-50 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-teal-600" />
              </div>
              <div>
                <p className="text-xl font-semibold text-navy-900">{lead.propertyName}</p>
                <p className="text-sm text-gray-500">Commercial Property</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Location</p>
                <p className="text-navy-900">
                  {lead.city}, {lead.state} {lead.zipCode}
                </p>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-navy-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <span className="text-lg font-semibold text-gray-600">
                    {lead.contactName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Contact Name</p>
                  <p className="font-medium text-navy-900">{lead.contactName}</p>
                </div>
              </div>

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

              <div className="flex items-center gap-3 sm:col-span-2">
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
            </div>
          </div>

          {/* Inquiry */}
          {lead.inquiry && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-navy-900 mb-4">
                <MessageSquare className="w-5 h-5 inline-block mr-2" />
                Inquiry Details
              </h2>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-navy-900 whitespace-pre-wrap">{lead.inquiry}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Update */}
          <StatusUpdateForm
            leadId={lead.id}
            leadType="commercial"
            currentStatus={lead.status}
            notes={lead.notes}
          />

          {/* Timeline */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-navy-900 mb-4">Timeline</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-navy-900">Inquiry Received</p>
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
        </div>
      </div>
    </div>
  );
}
