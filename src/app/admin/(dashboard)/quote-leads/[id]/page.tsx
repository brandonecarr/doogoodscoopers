import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, MapPin, Dog, Calendar, Clock, Pencil, Archive, Instagram } from "lucide-react";
import prisma from "@/lib/prisma";
import type { LeadStatus } from "@/types/leads";
import StatusUpdateForm from "@/components/admin/StatusUpdateForm";
import { LeadQuickActions } from "@/components/admin/LeadQuickActions";
import { LeadUpdates } from "@/components/admin/LeadUpdates";
import { LeadMessages } from "@/components/admin/LeadMessages";
import { DuplicateBanner } from "@/components/admin/DuplicateBanner";
import { isOptedOut } from "@/lib/sms-optout";
import { LeadActions } from "@/components/admin/LeadActions";
import { FollowupGrade } from "@/components/admin/FollowupGrade";
import { ArrangeableBoard, type ArrangeableCard } from "@/components/admin/ArrangeableBoard";
import { suggestInstagramLeadsForQuote } from "@/lib/instagram-leads";
import { InstagramMatchButton } from "@/components/admin/InstagramMatchButton";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getQuoteLead(id: string) {
  const lead = await prisma.quoteLead.findUnique({
    where: { id },
  });

  return lead;
}

async function getLeadUpdates(leadId: string) {
  const updates = await prisma.leadUpdate.findMany({
    where: {
      leadId,
      leadType: "QUOTE_FORM",
    },
    orderBy: { createdAt: "desc" },
  });

  return updates;
}

async function getLeadMessages(leadId: string) {
  return prisma.leadMessage.findMany({
    where: { leadId, leadType: "QUOTE_FORM" },
    orderBy: { createdAt: "asc" },
  });
}

// Format frequency values like "bi_weekly" → "Bi-Weekly"
function formatFrequency(frequency: string | null): string {
  if (!frequency) return "—";

  const frequencyMap: Record<string, string> = {
    weekly: "Weekly",
    bi_weekly: "Bi-Weekly",
    biweekly: "Bi-Weekly",
    monthly: "Monthly",
    one_time: "One-Time",
    onetime: "One-Time",
    twice_weekly: "Twice Weekly",
    // Values written by the admin lead form and AI call notes.
    "once a week": "Once a week",
    "twice a week": "Twice a week",
    "every other week": "Every other week",
    "one-time cleanup": "One-time cleanup",
  };

  return frequencyMap[frequency.toLowerCase()] || frequency.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Format lastCleaned values like "one_week" → "1 Week Ago"
function formatLastCleaned(lastCleaned: string | null): string {
  if (!lastCleaned) return "—";

  const lastCleanedMap: Record<string, string> = {
    one_week: "1 Week Ago",
    oneweek: "1 Week Ago",
    two_weeks: "2 Weeks Ago",
    twoweeks: "2 Weeks Ago",
    one_month: "1 Month Ago",
    onemonth: "1 Month Ago",
    two_months: "2+ Months Ago",
    twomonths: "2+ Months Ago",
    never: "Never",
    unknown: "Unknown",
    // Values written by the admin lead form and AI call notes.
    "less than a week": "Less than a week",
    "1-2 weeks": "1-2 weeks",
    "2-4 weeks": "2-4 weeks",
    "1+ month": "1+ month",
    "never/unknown": "Never/Unknown",
  };

  return lastCleanedMap[lastCleaned.toLowerCase()] || lastCleaned.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Format number of dogs
function formatNumberOfDogs(numberOfDogs: string | null): string {
  if (!numberOfDogs) return "—";

  const num = parseInt(numberOfDogs, 10);
  if (!isNaN(num)) {
    return num === 1 ? "1 Dog" : `${num} Dogs`;
  }

  return numberOfDogs;
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
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

function getGradeBadge(grade: string | null) {
  if (!grade) return null;

  const styles: Record<string, string> = {
    A: "bg-green-100 text-green-800 border-green-300",
    B: "bg-teal-100 text-teal-800 border-teal-300",
    C: "bg-yellow-100 text-yellow-800 border-yellow-300",
    D: "bg-orange-100 text-orange-800 border-orange-300",
    F: "bg-red-100 text-red-800 border-red-300",
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${styles[grade] || "bg-gray-100"}`}>
      Grade: {grade}
    </span>
  );
}

export default async function QuoteLeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [lead, updates, messages] = await Promise.all([
    getQuoteLead(id),
    getLeadUpdates(id),
    getLeadMessages(id),
  ]);

  if (!lead) {
    notFound();
  }

  // If this quote came in through a tracked Instagram DM link, load that lead.
  const igLead = lead.sourceChannel === "instagram" && lead.instagramLeadId
    ? await prisma.instagramLead.findUnique({ where: { id: lead.instagramLeadId } })
    : null;
  // Otherwise, suggest Instagram leads that clicked a quote link right before this quote landed.
  const igSuggestions = igLead ? [] : await suggestInstagramLeadsForQuote(lead);

  const optedOut = await isOptedOut(lead.phone);

  const dogsInfo = lead.dogsInfo as Array<{
    name: string;
    breed?: string;
    isSafe: boolean;
    comments?: string;
  }> | null;

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
      ),
    },
    {
      id: "service-details",
      zone: "main",
      node: (
        <div className="dgs-card p-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-4">Service Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Number of Dogs</p>
              <p className="text-xl font-semibold text-navy-900">{formatNumberOfDogs(lead.numberOfDogs)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Frequency</p>
              <p className="text-xl font-semibold text-navy-900">{formatFrequency(lead.frequency)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Last Cleaned</p>
              <p className="text-xl font-semibold text-navy-900">{formatLastCleaned(lead.lastCleaned)}</p>
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
      ),
    },
    ...(dogsInfo && dogsInfo.length > 0
      ? [
          {
            id: "dogs-info",
            zone: "main" as const,
            node: (
              <div className="dgs-card p-6">
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
            ),
          },
        ]
      : []),
    {
      id: "messages",
      zone: "main",
      node: (
        <LeadMessages
          leadId={lead.id}
          leadType="quote"
          phone={lead.phone}
          optedOut={optedOut}
          initialMessages={messages.map((m) => ({
            id: m.id,
            createdAt: m.createdAt.toISOString(),
            direction: m.direction,
            body: m.body,
            status: m.status,
            adminEmail: m.adminEmail,
          }))}
        />
      ),
    },
    {
      id: "updates",
      zone: "main",
      node: (
        <LeadUpdates
          leadId={lead.id}
          leadType="quote"
          updates={updates.map((u: { id: string; createdAt: Date; message: string | null; communicationType: string | null; adminEmail: string | null }) => ({
            id: u.id,
            createdAt: u.createdAt.toISOString(),
            message: u.message || "",
            communicationType: u.communicationType || "",
            adminEmail: u.adminEmail || "",
          }))}
        />
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
          numberOfDogs={lead.numberOfDogs}
        />
      ),
    },
    {
      id: "status",
      zone: "side",
      node: (
        <StatusUpdateForm
          leadId={lead.id}
          leadType="quote"
          currentStatus={lead.status}
          notes={lead.notes}
        />
      ),
    },
    {
      id: "followup",
      zone: "side",
      node: (
        <FollowupGrade
          leadId={lead.id}
          leadType="quote"
          currentFollowupDate={lead.followupDate?.toISOString()}
          currentGrade={lead.grade}
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
                <p className="text-xs text-gray-500" suppressHydrationWarning>{formatDate(lead.createdAt)}</p>
              </div>
            </div>

            {lead.updatedAt && lead.updatedAt > lead.createdAt && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-navy-900">Last Updated</p>
                  <p className="text-xs text-gray-500" suppressHydrationWarning>{formatDate(lead.updatedAt)}</p>
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
      ),
    },
    {
      id: "actions",
      zone: "side",
      node: (
        <LeadActions
          leadId={lead.id}
          leadType="quote"
          isArchived={lead.archived}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Duplicate leads banner */}
      <DuplicateBanner leadId={lead.id} leadType="quote" />

      {/* Instagram attribution — this quote came from a tracked auto-DM link */}
      {igLead && (
        <Link
          href={`/admin/instagram-leads/${igLead.id}`}
          className="flex items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100/60 transition-colors"
        >
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] flex items-center justify-center flex-shrink-0">
            <Instagram className="w-4 h-4 text-white" />
          </span>
          <div className="text-sm min-w-0">
            <p className="font-medium text-navy-900">Came from Instagram{igLead.username ? ` — @${igLead.username}` : ""}</p>
            <p className="text-gray-600 truncate">
              {igLead.campaignName ? `${igLead.campaignName} · ` : ""}commented “{igLead.commentText || "—"}” · view Instagram lead →
            </p>
          </div>
        </Link>
      )}

      {/* Suggested Instagram source — an IG lead clicked a quote link just before this quote landed */}
      {igSuggestions.length > 0 && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] flex items-center justify-center flex-shrink-0">
              <Instagram className="w-4 h-4 text-white" />
            </span>
            <p className="text-sm font-medium text-navy-900">Possibly from Instagram — confirm the match?</p>
          </div>
          <div className="divide-y divide-purple-100">
            {igSuggestions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2">
                <div className="flex-1 min-w-0 text-sm">
                  <Link href={`/admin/instagram-leads/${s.id}`} className="font-medium text-navy-900 hover:text-teal-600 hover:underline">
                    {s.username ? `@${s.username}` : "Instagram lead"}
                  </Link>
                  <p className="text-xs text-gray-600 truncate">
                    clicked the quote link {s.minutesBeforeQuote < 1 ? "under a minute" : `${s.minutesBeforeQuote} min`} before this quote
                    {s.commentText ? ` · commented “${s.commentText}”` : ""}
                  </p>
                </div>
                <InstagramMatchButton instagramLeadId={s.id} quoteLeadId={lead.id} label="It's them" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Archived Banner */}
      {lead.archived && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <Archive className="w-5 h-5 text-amber-600" />
          <p className="text-amber-800 font-medium">This lead has been archived</p>
        </div>
      )}

      {/* Header — dark hero */}
      <div className="dgs-hero p-[22px] sm:p-[26px]">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/quote-leads"
            className="p-2 rounded-[10px] bg-white/10 hover:bg-white/15 transition-colors mt-0.5 flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-[30px] font-extrabold text-white tracking-[-0.03em] truncate leading-none">
              {lead.firstName} {lead.lastName || ""}
            </h1>
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <span className="text-[#9C9CB0] text-[12.5px]">Quote Lead</span>
              {getGradeBadge(lead.grade)}
              {getStatusBadge(lead.status)}
            </div>
          </div>
        </div>
      </div>

      <ArrangeableBoard
        layoutId="quotelead"
        cards={cards}
        actions={
          <Link
            href={`/admin/quote-leads/${lead.id}/edit`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors text-sm font-medium flex-shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </Link>
        }
      />
    </div>
  );
}
