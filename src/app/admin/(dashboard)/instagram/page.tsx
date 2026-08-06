import prisma from "@/lib/prisma";
import { Instagram } from "lucide-react";
import { isInstagramConfigured } from "@/lib/instagram";
import { InstagramManager, type IgCampaign } from "@/components/admin/InstagramManager";
import { InstagramActivity, type IgActivityItem } from "@/components/admin/InstagramActivity";
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
  const activityItems: IgActivityItem[] = recent.map((d) => ({
    id: d.id, username: d.username, commentText: d.commentText ?? "", status: d.status, when: fmt(d.createdAt, timeZone),
  }));

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div>
        <h1 className="dgs-title flex items-center gap-2">
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

      <InstagramActivity items={activityItems} timeZone={timeZone} />
    </div>
  );
}
