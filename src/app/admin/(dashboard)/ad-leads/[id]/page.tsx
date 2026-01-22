import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Megaphone, Mail, Phone, MapPin, Calendar, Tag } from "lucide-react";
import prisma from "@/lib/prisma";
import StatusUpdateForm from "@/components/admin/StatusUpdateForm";
import type { AdLead } from "@/types/leads";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getAdLead(id: string) {
  const lead = await prisma.adLead.findUnique({
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

function getDisplayName(lead: AdLead) {
  if (lead.fullName) return lead.fullName;
  if (lead.firstName || lead.lastName) {
    return `${lead.firstName || ""} ${lead.lastName || ""}`.trim();
  }
  return "Unknown";
}

export default async function AdLeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  const lead = await getAdLead(id);

  if (!lead) {
    notFound();
  }

  const typedLead = lead as AdLead;

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/ad-leads"
          className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-navy-900">{getDisplayName(typedLead)}</h1>
          <p className="text-navy-600">Ad Lead Details</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-pink-50 flex items-center justify-center">
          <Megaphone className="w-6 h-6 text-pink-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-navy-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium text-navy-900">
                    {typedLead.phone ? (
                      <a href={`tel:${typedLead.phone}`} className="hover:text-teal-600">
                        {typedLead.phone}
                      </a>
                    ) : (
                      <span className="text-gray-400">Not provided</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-navy-900">
                    {typedLead.email ? (
                      <a href={`mailto:${typedLead.email}`} className="hover:text-teal-600">
                        {typedLead.email}
                      </a>
                    ) : (
                      <span className="text-gray-400">Not provided</span>
                    )}
                  </p>
                </div>
              </div>

              {!!(typedLead.city || typedLead.state || typedLead.zipCode) && (
                <div className="flex items-start gap-3 sm:col-span-2">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="font-medium text-navy-900">
                      {[typedLead.city, typedLead.state, typedLead.zipCode].filter((x): x is string => Boolean(x)).join(", ") || "-"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Campaign Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-navy-900 mb-4">Campaign Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-pink-50 flex items-center justify-center flex-shrink-0">
                  <Tag className="w-5 h-5 text-pink-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ad Source</p>
                  <p className="font-medium text-navy-900">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-pink-100 text-pink-800">
                      {typedLead.adSource || "meta"}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Received</p>
                  <p className="font-medium text-navy-900">{formatDate(typedLead.createdAt)}</p>
                </div>
              </div>

              {typedLead.campaignName && (
                <div>
                  <p className="text-sm text-gray-500">Campaign Name</p>
                  <p className="font-medium text-navy-900">{typedLead.campaignName}</p>
                </div>
              )}

              {typedLead.adSetName && (
                <div>
                  <p className="text-sm text-gray-500">Ad Set</p>
                  <p className="font-medium text-navy-900">{typedLead.adSetName}</p>
                </div>
              )}

              {typedLead.adName && (
                <div>
                  <p className="text-sm text-gray-500">Ad Name</p>
                  <p className="font-medium text-navy-900">{typedLead.adName}</p>
                </div>
              )}

              {typedLead.formName && (
                <div>
                  <p className="text-sm text-gray-500">Form Name</p>
                  <p className="font-medium text-navy-900">{typedLead.formName}</p>
                </div>
              )}
            </div>
          </div>

          {/* Custom Fields */}
          {(() => {
            const fields = typedLead.customFields as Record<string, unknown> | null;
            if (!fields || Object.keys(fields).length === 0) return null;
            return (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-navy-900 mb-4">Additional Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(fields).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-sm text-gray-500 capitalize">{key.replace(/_/g, " ")}</p>
                      <p className="font-medium text-navy-900">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Raw Payload (collapsible for debugging) */}
          {typedLead.rawPayload ? (
            <details className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <summary className="text-lg font-semibold text-navy-900 cursor-pointer">
                Raw Webhook Data
              </summary>
              <pre className="mt-4 p-4 bg-gray-50 rounded-lg text-xs overflow-x-auto">
                {JSON.stringify(typedLead.rawPayload, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <StatusUpdateForm
            leadId={typedLead.id}
            leadType="adlead"
            currentStatus={typedLead.status}
            notes={typedLead.notes}
          />

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-navy-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              {typedLead.phone && (
                <>
                  <a
                    href={`tel:${typedLead.phone}`}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    Call Lead
                  </a>
                  <a
                    href={`sms:${typedLead.phone}`}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 text-navy-900 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Send SMS
                  </a>
                </>
              )}
              {typedLead.email && (
                <a
                  href={`mailto:${typedLead.email}`}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 text-navy-900 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Send Email
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
