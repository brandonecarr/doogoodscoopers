import Link from "next/link";
import { Plus, Megaphone, Send, Clock, CheckCircle2, Zap } from "lucide-react";
import prisma from "@/lib/prisma";
import { CampaignPauseToggle } from "@/components/admin/CampaignPauseToggle";
import { BlastApproval } from "@/components/admin/BlastApproval";
import { SendingHoursCard } from "@/components/admin/SendingHoursCard";
import { MessengerAutoReplyCard } from "@/components/admin/MessengerAutoReplyCard";
import { PageHero, heroBtnPrimary, heroBtnSecondary, heroPrimaryStyle } from "@/components/admin/PageHero";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const statusStyles: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_APPROVAL: "bg-orange-100 text-orange-800",
  QUEUED: "bg-amber-100 text-amber-800",
  SENDING: "bg-blue-100 text-blue-800",
  SENT: "bg-green-100 text-green-800",
};

const statusLabels: Record<string, string> = {
  PENDING_APPROVAL: "Awaiting approval",
};

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <PageHero
        title="Campaigns"
        subtitle="Bulk text a segment of your leads."
        actions={
          <>
            <Link href="/admin/templates" className={heroBtnSecondary}>
              Templates
            </Link>
            <Link href="/admin/campaigns/new-drip" className={heroBtnSecondary}>
              <Zap className="w-4 h-4" />
              New Drip
            </Link>
            <Link href="/admin/campaigns/new" className={heroBtnPrimary} style={heroPrimaryStyle}>
              <Plus className="w-4 h-4" />
              New Blast
            </Link>
          </>
        }
      />

      <SendingHoursCard />
      <MessengerAutoReplyCard />

      {campaigns.length === 0 ? (
        <div className="dgs-card p-12 text-center">
          <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No campaigns yet.</p>
          <Link href="/admin/campaigns/new" className="text-iris-deep text-sm font-medium hover:underline mt-2 inline-block">
            Create your first campaign →
          </Link>
        </div>
      ) : (
        <div className="dgs-card divide-y divide-gray-100">
          {campaigns.map((c) => {
            const isDrip = c.type === "DRIP";
            return (
              <div key={c.id} className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-iris-soft flex items-center justify-center flex-shrink-0">
                  {isDrip ? (
                    <Zap className="w-5 h-5 text-iris-deep" />
                  ) : c.status === "SENT" ? (
                    <CheckCircle2 className="w-5 h-5 text-iris-deep" />
                  ) : c.status === "SENDING" ? (
                    <Send className="w-5 h-5 text-iris-deep" />
                  ) : (
                    <Clock className="w-5 h-5 text-iris-deep" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/campaigns/${c.id}`} className="font-medium text-navy-900 truncate hover:text-iris-deep hover:underline">
                      {c.name}
                    </Link>
                    <span className={`px-1.5 py-0.5 text-[10px] rounded ${isDrip ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                      {isDrip ? "DRIP" : "BLAST"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">{c.body}</p>
                </div>
                <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                  {isDrip ? (
                    <>
                      <div className="flex items-center gap-2">
                        {c.status === "DRAFT" ? (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">Draft</span>
                        ) : (
                          <>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${c.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                              {c.active ? "Active" : "Paused"}
                            </span>
                            <CampaignPauseToggle campaignId={c.id} active={c.active} />
                          </>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {c.totalRecipients} enrolled · {c.sentCount} sent{c.failedCount ? ` · ${c.failedCount} failed` : ""}
                      </p>
                    </>
                  ) : (
                    <>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusStyles[c.status] || "bg-gray-100 text-gray-700"}`}>
                        {statusLabels[c.status] || c.status}
                      </span>
                      {c.status === "PENDING_APPROVAL" ? (
                        <>
                          <p className="text-xs text-gray-500">Will send to {c.totalRecipients} recipient{c.totalRecipients === 1 ? "" : "s"}</p>
                          <BlastApproval campaignId={c.id} recipientCount={c.totalRecipients} />
                        </>
                      ) : (
                        <p className="text-xs text-gray-500">
                          {c.sentCount}/{c.totalRecipients} sent{c.failedCount ? ` · ${c.failedCount} failed` : ""}
                        </p>
                      )}
                    </>
                  )}
                  <p className="text-xs text-gray-400" suppressHydrationWarning>{formatDate(c.createdAt)}</p>
                  <Link href={`/admin/campaigns/${c.id}/edit`} className="text-xs text-iris-deep hover:underline">
                    Edit
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
