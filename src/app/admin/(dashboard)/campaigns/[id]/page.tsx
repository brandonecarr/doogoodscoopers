import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Zap, Users, CheckCircle2, StopCircle, Clock, Pencil } from "lucide-react";
import prisma from "@/lib/prisma";
import type { LeadSource } from "@prisma/client";
import { CampaignPauseToggle } from "@/components/admin/CampaignPauseToggle";
import { RecipientStopButton } from "@/components/admin/RecipientStopButton";
import { AddCustomersButton } from "@/components/admin/AddCustomersButton";
import { CampaignActivateButton } from "@/components/admin/CampaignActivateButton";
import { loadSendWindow } from "@/lib/send-window";

export const dynamic = "force-dynamic";

const pathFor: Record<LeadSource, string> = {
  QUOTE_FORM: "quote-leads",
  AD_LEAD: "ad-leads",
  OUT_OF_AREA: "out-of-area",
  COMMERCIAL: "commercial",
  CAREERS: "careers",
  CUSTOMER: "customers",
  INSTAGRAM: "instagram-leads",
  CANVASSER: "canvasser-leads",  COMMERCIAL_PROSPECT: "Call-list prospect",
};

function fmt(d: Date | null, timeZone: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  });
}

function humanDelay(min: number) {
  if (min <= 0) return "immediately";
  if (min % 1440 === 0) return `${min / 1440}d`;
  if (min % 60 === 0) return `${min / 60}h`;
  return `${min}m`;
}

const recStatusStyle: Record<string, string> = {
  ACTIVE: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  STOPPED: "bg-gray-200 text-gray-700",
  PENDING: "bg-amber-100 text-amber-800",
  SENT: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  SKIPPED: "bg-gray-100 text-gray-600",
};

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });
  if (!campaign) notFound();

  const isDrip = campaign.type === "DRIP";
  const isDraft = campaign.status === "DRAFT";
  const { timeZone } = await loadSendWindow();
  const [recipients, messages, sentPerLead] = await Promise.all([
    prisma.campaignRecipient.findMany({ where: { campaignId: id }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.leadMessage.findMany({ where: { campaignId: id }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, phone: true, body: true, status: true, createdAt: true, direction: true } }),
    // Messages that actually left — currentStep advances even when a send fails,
    // so it can't be used to report what the recipient received.
    prisma.leadMessage.groupBy({
      by: ["leadId"],
      where: { campaignId: id, direction: "OUTBOUND", NOT: { status: "FAILED" } },
      _count: { _all: true },
    }),
  ]);
  const deliveredByLead = new Map(sentPerLead.map((g) => [g.leadId, g._count._all]));

  const totalSteps = campaign.steps.length;
  const counts = recipients.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
  const trigger = ((campaign.audienceFilter as { leadTypes?: string[] } | null)?.leadTypes) || [];

  const stat = (label: string, value: number | string, Icon: typeof Users) => (
    <div className="dgs-card p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-teal-600" />
      </div>
      <div>
        <p className="text-lg font-semibold text-navy-900 leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header — dark hero */}
      <div className="dgs-hero p-[22px] sm:p-[26px]">
        <div className="flex items-start gap-3">
          <Link href="/admin/campaigns" className="p-2 rounded-[10px] bg-white/10 hover:bg-white/15 transition-colors mt-0.5 flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[30px] font-extrabold text-white tracking-[-0.03em] leading-none truncate">{campaign.name}</h1>
              <span className={`px-1.5 py-0.5 text-[10px] rounded ${isDrip ? "bg-purple-100 text-purple-700" : "bg-white/15 text-white/80"}`}>
                {isDrip ? "DRIP" : "BLAST"}
              </span>
              {isDrip && (
                isDraft ? (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">Draft</span>
                ) : (
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${campaign.active ? "bg-green-100 text-green-800" : "bg-white/15 text-white/80"}`}>
                    {campaign.active ? "Active" : "Paused"}
                  </span>
                )
              )}
            </div>
            {isDrip && (
              <p className="text-[#9C9CB0] text-[12.5px] mt-2">
                Trigger: {trigger.join(", ") || "—"} · stops on reply: {campaign.stopOnReply ? "yes" : "no"}
              </p>
            )}
          </div>
          {isDrip && (isDraft ? <CampaignActivateButton campaignId={campaign.id} /> : <CampaignPauseToggle campaignId={campaign.id} active={campaign.active} size="md" />)}
          <Link
            href={`/admin/campaigns/${campaign.id}/edit`}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/10 text-white rounded-[12px] hover:bg-white/15 transition-colors text-sm font-semibold flex-shrink-0"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stat("Enrolled", recipients.length, Users)}
        {isDrip
          ? stat("Active", counts.ACTIVE || 0, Zap)
          : stat("Sent", counts.SENT || 0, CheckCircle2)}
        {stat(isDrip ? "Completed" : "Failed", (isDrip ? counts.COMPLETED : counts.FAILED) || 0, isDrip ? CheckCircle2 : StopCircle)}
        {stat(isDrip ? "Stopped" : "Skipped", (isDrip ? counts.STOPPED : counts.SKIPPED) || 0, StopCircle)}
      </div>

      {/* Sequence (drip) */}
      {isDrip && (
        <div className="dgs-card p-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-3">Sequence ({totalSteps} messages)</h2>
          <ol className="space-y-2">
            {campaign.steps.map((s, i) => (
              <li key={s.id} className="flex gap-3 text-sm">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-50 text-teal-700 text-xs flex items-center justify-center font-medium">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-gray-500">{i === 0 ? "immediately" : `+${humanDelay(s.delayMinutes)} after previous`}</span>
                  <p className="text-gray-800 whitespace-pre-wrap">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Recipients */}
      <div className="dgs-card p-6">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-lg font-semibold text-navy-900">Recipients ({recipients.length})</h2>
          {isDrip && <AddCustomersButton campaignId={campaign.id} />}
        </div>
        {recipients.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            {isDrip ? "No one enrolled yet — new matching leads will appear here." : "No recipients."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Phone</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  {isDrip ? (
                    <>
                      <th className="pb-2 pr-4 font-medium">Progress</th>
                      <th className="pb-2 pr-4 font-medium">Next</th>
                    </>
                  ) : (
                    <th className="pb-2 pr-4 font-medium">Sent</th>
                  )}
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recipients.map((r) => {
                  const received = Math.min(r.currentStep, totalSteps);
                  return (
                    <tr key={r.id}>
                      <td className="py-2 pr-4">
                        {r.leadType === "CUSTOMER" ? (
                          <span className="text-navy-900">{r.name || "Unknown"}</span>
                        ) : (
                          <Link href={`/admin/${pathFor[r.leadType]}/${r.leadId}`} className="text-navy-900 hover:text-teal-600 hover:underline">
                            {r.name || "Unknown"}
                          </Link>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{r.phone}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${recStatusStyle[r.status] || "bg-gray-100 text-gray-600"}`}>
                          {r.status}
                        </span>
                        {r.error ? (
                          <span className={`text-xs ml-1 ${r.status === "STOPPED" ? "text-gray-400" : "text-red-600"}`}>
                            ({r.error})
                          </span>
                        ) : null}
                      </td>
                      {isDrip ? (
                        <>
                          <td className="py-2 pr-4 text-gray-700">
                            {deliveredByLead.get(r.leadId) ?? 0} of {totalSteps} sent
                            {received > (deliveredByLead.get(r.leadId) ?? 0) && (
                              <span className="text-red-600"> · {received - (deliveredByLead.get(r.leadId) ?? 0)} failed</span>
                            )}
                          </td>
                          <td className="py-2 pr-4 text-gray-500" suppressHydrationWarning>
                            {r.status === "ACTIVE" ? fmt(r.nextSendAt, timeZone) : r.status === "COMPLETED" ? "done" : "—"}
                          </td>
                        </>
                      ) : (
                        <td className="py-2 pr-4 text-gray-500" suppressHydrationWarning>{fmt(r.sentAt, timeZone)}</td>
                      )}
                      <td className="py-2 text-right">
                        {r.status === "ACTIVE" || r.status === "PENDING" || r.status === "STOPPED" ? (
                          <RecipientStopButton campaignId={campaign.id} recipientId={r.id} stopped={r.status === "STOPPED"} />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Message log */}
      <div className="dgs-card p-6">
        <h2 className="text-lg font-semibold text-navy-900 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          Message log
        </h2>
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No messages sent yet.</p>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => (
              <div key={m.id} className="flex items-start gap-3 text-sm border-b border-gray-50 pb-2">
                <span className="text-xs text-gray-400 w-28 flex-shrink-0" suppressHydrationWarning>{fmt(m.createdAt, timeZone)}</span>
                <span className="text-xs text-gray-500 w-28 flex-shrink-0">{m.phone}</span>
                <span className="flex-1 text-gray-800 truncate">{m.body}</span>
                <span className={`text-[11px] px-1.5 py-0.5 rounded ${recStatusStyle[m.status || ""] || "bg-gray-100 text-gray-500"}`}>
                  {(m.status || "").toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
