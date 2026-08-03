import prisma from "@/lib/prisma";
import { Instagram } from "lucide-react";
import { isInstagramConfigured } from "@/lib/instagram";
import { InstagramManager, type IgCampaign } from "@/components/admin/InstagramManager";
import { loadSendWindow } from "@/lib/send-window";

export const dynamic = "force-dynamic";

function fmt(d: Date, timeZone: string) {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  });
}
const STATUS_STYLE: Record<string, string> = {
  SENT: "bg-green-50 text-green-700",
  QUEUED: "bg-blue-50 text-blue-700",
  RATE_LIMITED: "bg-amber-50 text-amber-700",
  FAILED: "bg-red-50 text-red-700",
  SKIPPED: "bg-gray-100 text-gray-600",
};

export default async function InstagramPage() {
  const [campaigns, recent, { timeZone }] = await Promise.all([
    prisma.instagramCampaign.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.instagramDm.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    loadSendWindow(),
  ]);
  const configured = isInstagramConfigured();
  const igCampaigns: IgCampaign[] = campaigns.map((c) => ({
    id: c.id, name: c.name, mediaId: c.mediaId, keywords: c.keywords, matchType: c.matchType,
    dmText: c.dmText, publicReply: c.publicReply, active: c.active,
    matchedCount: c.matchedCount, sentCount: c.sentCount, failedCount: c.failedCount,
  }));

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div>
        <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] flex items-center justify-center">
            <Instagram className="w-4 h-4 text-white" />
          </span>
          Instagram Auto-DM
        </h1>
        <p className="text-navy-600 text-sm mt-1">When someone comments a keyword on your post or reel, we automatically DM them.</p>
      </div>

      {!configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <b>Not connected yet.</b> Add <code className="bg-white px-1 rounded">IG_PAGE_TOKEN</code>, <code className="bg-white px-1 rounded">IG_ACCOUNT_ID</code>,
          {" "}<code className="bg-white px-1 rounded">IG_VERIFY_TOKEN</code> and <code className="bg-white px-1 rounded">META_APP_SECRET</code> to your environment,
          then point the Meta webhook at <code className="bg-white px-1 rounded">/api/webhooks/instagram</code> (subscribe to the <b>comments</b> field). You can build campaigns now — they start sending once connected.
        </div>
      )}

      <InstagramManager campaigns={igCampaigns} />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-navy-900">Recent activity</h2>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-500 px-4 py-8 text-center">No comments matched yet. When they do, every send shows here — queued, sent, skipped, or failed.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {recent.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="font-medium text-navy-900 flex-shrink-0">{d.username ? `@${d.username}` : "someone"}</span>
                <span className="text-gray-500 truncate flex-1 min-w-0">commented “{d.commentText}”</span>
                <span className={`text-[11px] px-1.5 py-0.5 rounded ${STATUS_STYLE[d.status] || "bg-gray-100 text-gray-600"}`}>{d.status.toLowerCase().replace("_", " ")}</span>
                <span className="text-[11px] text-gray-400 whitespace-nowrap" suppressHydrationWarning>{fmt(d.createdAt, timeZone)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
