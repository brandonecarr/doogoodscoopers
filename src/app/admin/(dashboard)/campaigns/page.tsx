import Link from "next/link";
import { Plus, Megaphone, Send, Clock, CheckCircle2, Zap } from "lucide-react";
import prisma from "@/lib/prisma";
import { CampaignPauseToggle } from "@/components/admin/CampaignPauseToggle";
import { SendingHoursCard } from "@/components/admin/SendingHoursCard";

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
  QUEUED: "bg-amber-100 text-amber-800",
  SENDING: "bg-blue-100 text-blue-800",
  SENT: "bg-green-100 text-green-800",
};

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Campaigns</h1>
          <p className="text-navy-600 text-sm mt-1">Bulk text a segment of your leads.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/templates"
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-navy-900 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Templates
          </Link>
          <Link
            href="/admin/campaigns/new-drip"
            className="flex items-center gap-1.5 px-4 py-2 border border-teal-200 text-teal-700 rounded-lg hover:bg-teal-50 transition-colors text-sm font-medium"
          >
            <Zap className="w-4 h-4" />
            New Drip
          </Link>
          <Link
            href="/admin/campaigns/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Blast
          </Link>
        </div>
      </div>

      <SendingHoursCard />

      {campaigns.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No campaigns yet.</p>
          <Link href="/admin/campaigns/new" className="text-teal-600 text-sm font-medium hover:underline mt-2 inline-block">
            Create your first campaign →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          {campaigns.map((c) => {
            const isDrip = c.type === "DRIP";
            return (
              <div key={c.id} className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                  {isDrip ? (
                    <Zap className="w-5 h-5 text-teal-600" />
                  ) : c.status === "SENT" ? (
                    <CheckCircle2 className="w-5 h-5 text-teal-600" />
                  ) : c.status === "SENDING" ? (
                    <Send className="w-5 h-5 text-teal-600" />
                  ) : (
                    <Clock className="w-5 h-5 text-teal-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/campaigns/${c.id}`} className="font-medium text-navy-900 truncate hover:text-teal-600 hover:underline">
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
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${c.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                          {c.active ? "Active" : "Paused"}
                        </span>
                        <CampaignPauseToggle campaignId={c.id} active={c.active} />
                      </div>
                      <p className="text-xs text-gray-500">
                        {c.totalRecipients} enrolled · {c.sentCount} sent{c.failedCount ? ` · ${c.failedCount} failed` : ""}
                      </p>
                    </>
                  ) : (
                    <>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusStyles[c.status] || "bg-gray-100 text-gray-700"}`}>
                        {c.status}
                      </span>
                      <p className="text-xs text-gray-500">
                        {c.sentCount}/{c.totalRecipients} sent{c.failedCount ? ` · ${c.failedCount} failed` : ""}
                      </p>
                    </>
                  )}
                  <p className="text-xs text-gray-400" suppressHydrationWarning>{formatDate(c.createdAt)}</p>
                  <Link href={`/admin/campaigns/${c.id}/edit`} className="text-xs text-teal-600 hover:underline">
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
