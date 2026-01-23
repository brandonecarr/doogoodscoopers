import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, MapPin, Dog, Calendar, Clock, Pencil } from "lucide-react";
import prisma from "@/lib/prisma";
import type { LeadStatus } from "@/types/leads";
import StatusUpdateForm from "@/components/admin/StatusUpdateForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getQuoteLead(id: string) {
  const lead = await prisma.quoteLead.findUnique({
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

export default async function QuoteLeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  const lead = await getQuoteLead(id);

  if (!lead) {
    notFound();
  }

  const dogsInfo = lead.dogsInfo as Array<{
    name: string;
    breed?: string;
    isSafe: boolean;
    comments?: string;
  }> | null;

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/quote-leads"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-navy-900">
            {lead.firstName} {lead.lastName || ""}
          </h1>
          <p className="text-navy-600 mt-1">Quote Lead</p>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(lead.status)}
          <Link
            href={`/admin/quote-leads/${lead.id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-navy-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="text-navy-900">
                    {lead.address ? `${lead.address}, ` : ""}
                    {lead.city ? `${lead.city}, ` : ""}
                    {lead.zipCode}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Service Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-navy-900 mb-4">Service Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Number of Dogs</p>
                <p className="text-xl font-semibold text-navy-900">{lead.numberOfDogs || "—"}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Frequency</p>
                <p className="text-xl font-semibold text-navy-900">{lead.frequency || "—"}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Last Cleaned</p>
                <p className="text-xl font-semibold text-navy-900">{lead.lastCleaned || "—"}</p>
              </div>
            </div>

            {(lead.gateLocation || lead.gateCode) && (
              <div className="mt-4 p-4 bg-amber-50 rounded-lg">
                <p className="text-sm font-medium text-amber-800">Gate Information</p>
                <div className="mt-2 space-y-1">
                  {lead.gateLocation && (
                    <p className="text-sm text-amber-700">Location: {lead.gateLocation}</p>
                  )}
                  {lead.gateCode && (
                    <p className="text-sm text-amber-700">Code: {lead.gateCode}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Dogs Info */}
          {dogsInfo && dogsInfo.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-navy-900 mb-4">
                <Dog className="w-5 h-5 inline-block mr-2" />
                Dogs Information
              </h2>
              <div className="space-y-3">
                {dogsInfo.map((dog, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg ${dog.isSafe ? "bg-green-50" : "bg-red-50"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-navy-900">{dog.name}</p>
                        {dog.breed && <p className="text-sm text-gray-600">{dog.breed}</p>}
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          dog.isSafe
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {dog.isSafe ? "Safe" : "Not Safe"}
                      </span>
                    </div>
                    {dog.comments && (
                      <p className="mt-2 text-sm text-gray-600">{dog.comments}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Update */}
          <StatusUpdateForm
            leadId={lead.id}
            leadType="quote"
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

              {lead.lastStep && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Form Progress</p>
                  <p className="text-sm font-medium text-navy-900">
                    Last completed: {lead.lastStep}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
