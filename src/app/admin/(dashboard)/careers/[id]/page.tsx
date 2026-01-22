import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  User,
  Briefcase,
} from "lucide-react";
import prisma from "@/lib/prisma";
import type { LeadStatus } from "@/types/leads";
import StatusUpdateForm from "@/components/admin/StatusUpdateForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getCareerApplication(id: string) {
  const application = await prisma.careerApplication.findUnique({
    where: { id },
  });

  return application;
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

function BooleanBadge({ value, trueLabel, falseLabel }: { value: boolean; trueLabel: string; falseLabel: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
        value ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }`}
    >
      {value ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {value ? trueLabel : falseLabel}
    </span>
  );
}

export default async function CareerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const app = await getCareerApplication(id);

  if (!app) {
    notFound();
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/careers"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-navy-900">
            {app.firstName} {app.lastName}
          </h1>
          <p className="text-navy-600 mt-1">Career Application</p>
        </div>
        {getStatusBadge(app.status as LeadStatus)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-navy-900 mb-4">
              <User className="w-5 h-5 inline-block mr-2" />
              Personal Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <a href={`tel:${app.phone}`} className="text-navy-900 hover:text-teal-600">
                    {app.phone}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <a href={`mailto:${app.email}`} className="text-navy-900 hover:text-teal-600">
                    {app.email}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="text-navy-900">{app.address}, {app.city}</p>
                </div>
              </div>

              {app.dateOfBirth && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date of Birth</p>
                    <p className="text-navy-900">{app.dateOfBirth}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Sensitive Info */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-2">Sensitive Information</p>
              <div className="grid grid-cols-2 gap-4">
                {app.driversLicense && (
                  <div>
                    <p className="text-xs text-gray-500">Driver&apos;s License</p>
                    <p className="text-sm font-mono text-navy-900">{app.driversLicense}</p>
                  </div>
                )}
                {app.ssnLast4 && (
                  <div>
                    <p className="text-xs text-gray-500">SSN (Last 4)</p>
                    <p className="text-sm font-mono text-navy-900">***-**-{app.ssnLast4}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Employment Eligibility */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-navy-900 mb-4">Employment Eligibility</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <BooleanBadge
                  value={app.legalCitizen}
                  trueLabel="Eligible"
                  falseLabel="Not Eligible"
                />
                <p className="text-xs text-gray-500 mt-2">Work Authorization</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <BooleanBadge
                  value={app.hasAutoInsurance}
                  trueLabel="Yes"
                  falseLabel="No"
                />
                <p className="text-xs text-gray-500 mt-2">Auto Insurance</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <BooleanBadge
                  value={!app.convictedFelony}
                  trueLabel="Clean"
                  falseLabel="Has Record"
                />
                <p className="text-xs text-gray-500 mt-2">Felony Record</p>
              </div>
            </div>
          </div>

          {/* Work History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-navy-900 mb-4">
              <Briefcase className="w-5 h-5 inline-block mr-2" />
              Work History
            </h2>
            <div className="space-y-4">
              {app.currentEmployment && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Current Employment</p>
                  <p className="text-navy-900 whitespace-pre-wrap">{app.currentEmployment}</p>
                </div>
              )}

              {app.workDuties && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Work Duties</p>
                  <p className="text-navy-900 whitespace-pre-wrap">{app.workDuties}</p>
                </div>
              )}

              {app.whyLeftPrevious && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Why Left Previous Job</p>
                  <p className="text-navy-900 whitespace-pre-wrap">{app.whyLeftPrevious}</p>
                </div>
              )}

              <div className="flex items-center gap-4">
                <BooleanBadge
                  value={app.mayContactEmployers}
                  trueLabel="May Contact"
                  falseLabel="Do Not Contact"
                />
                <span className="text-sm text-gray-500">Previous Employers</span>
              </div>

              {app.previousBossContact && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Previous Boss Contact Info</p>
                  <p className="text-navy-900 whitespace-pre-wrap">{app.previousBossContact}</p>
                </div>
              )}
            </div>
          </div>

          {/* References */}
          {app.references && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-navy-900 mb-4">References</h2>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-navy-900 whitespace-pre-wrap">{app.references}</p>
              </div>
            </div>
          )}

          {/* Why Work Here */}
          {app.whyWorkHere && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-navy-900 mb-4">
                <FileText className="w-5 h-5 inline-block mr-2" />
                Why They Want to Work Here
              </h2>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-navy-900 whitespace-pre-wrap">{app.whyWorkHere}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Update */}
          <StatusUpdateForm
            leadId={app.id}
            leadType="career"
            currentStatus={app.status as LeadStatus}
            notes={app.notes}
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
                  <p className="text-sm font-medium text-navy-900">Application Received</p>
                  <p className="text-xs text-gray-500">{formatDate(app.createdAt)}</p>
                </div>
              </div>

              {app.updatedAt && app.updatedAt > app.createdAt && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-navy-900">Last Updated</p>
                    <p className="text-xs text-gray-500">{formatDate(app.updatedAt)}</p>
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
