"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink, Loader2, Heart, MessageCircle, Send, Clock, History, CheckCircle2, UserRound } from "lucide-react";

export interface IgActivityItem {
  id: string;
  username: string | null;
  commentText: string;
  status: string;
  when: string;
}

const STATUS_STYLE: Record<string, string> = {
  SENT: "bg-green-50 text-green-700",
  QUEUED: "bg-blue-50 text-blue-700",
  RATE_LIMITED: "bg-amber-50 text-amber-700",
  FAILED: "bg-red-50 text-red-700",
  SKIPPED: "bg-gray-100 text-gray-600",
};

interface Detail {
  dm: {
    id: string;
    username: string | null;
    igUserId: string | null;
    commentText: string;
    dmText: string;
    status: string;
    error: string | null;
    createdAt: string;
    sentAt: string | null;
    mediaId: string | null;
    commentId: string;
  };
  campaign: { id: string; name: string; matchType: string; publicReply: string | null } | null;
  matchedKeyword: string | null;
  history: Array<{ id: string; commentText: string; status: string; createdAt: string }>;
  historyCount: number;
  igLead: { id: string; status: string; convertedQuoteLeadId: string | null } | null;
  media: { permalink?: string; caption?: string; media_type?: string; media_url?: string; thumbnail_url?: string; timestamp?: string } | null;
  comment: { text?: string; timestamp?: string; like_count?: number } | null;
}

function statusBadge(status: string) {
  return `text-[11px] px-1.5 py-0.5 rounded ${STATUS_STYLE[status] || "bg-gray-100 text-gray-600"}`;
}

export function InstagramActivity({ items, timeZone }: { items: IgActivityItem[]; timeZone: string }) {
  const [openId, setOpenId] = useState<string | null>(null);

  const fmt = (iso: string | null | undefined) =>
    iso
      ? new Date(iso).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone,
          timeZoneName: "short",
        })
      : "—";

  return (
    <div className="dgs-card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-navy-900">Recent activity</h2>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 px-4 py-8 text-center">
          No comments matched yet. When they do, every send shows here — queued, sent, skipped, or failed.
        </p>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map((d) => (
            <button
              key={d.id}
              onClick={() => setOpenId(d.id)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-navy-900 flex-shrink-0">{d.username ? `@${d.username}` : "someone"}</span>
              <span className="text-gray-500 truncate flex-1 min-w-0">commented “{d.commentText}”</span>
              <span className={statusBadge(d.status)}>{d.status.toLowerCase().replace("_", " ")}</span>
              <span className="text-[11px] text-gray-400 whitespace-nowrap" suppressHydrationWarning>{d.when}</span>
            </button>
          ))}
        </div>
      )}

      {openId && <ActivityDrawer key={openId} id={openId} onClose={() => setOpenId(null)} fmt={fmt} />}
    </div>
  );
}

function ActivityDrawer({ id, onClose, fmt }: { id: string; onClose: () => void; fmt: (iso: string | null | undefined) => string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  // Drawer is remounted per id (key={openId}), so `loading` starts true each open.
  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/instagram/activity/${id}`)
      .then((r) => r.json())
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dm = data?.dm;
  const latency =
    dm?.sentAt && dm?.createdAt ? ((new Date(dm.sentAt).getTime() - new Date(dm.createdAt).getTime()) / 1000).toFixed(1) + "s" : null;
  const thumb = data?.media?.thumbnail_url || data?.media?.media_url;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-xl overflow-y-auto animate-[slidein_0.2s_ease-out]">
        <style>{`@keyframes slidein{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <p className="font-semibold text-navy-900 truncate">{dm?.username ? `@${dm.username}` : "Comment activity"}</p>
            {dm && <span className={statusBadge(dm.status) + " inline-block mt-1"}>{dm.status.toLowerCase().replace("_", " ")}</span>}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg flex-shrink-0" title="Close">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : !dm ? (
          <p className="p-5 text-sm text-red-600">Couldn’t load this activity.</p>
        ) : (
          <div className="p-5 space-y-6">
            {/* Lead links */}
            {data?.igLead && (
              <div className="flex flex-col gap-2">
                <a href={`/admin/instagram-leads/${data.igLead.id}`} className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:underline">
                  <UserRound className="w-4 h-4" /> View full Instagram lead <ExternalLink className="w-3 h-3" />
                </a>
                {data.igLead.convertedQuoteLeadId && (
                  <a href={`/admin/quote-leads/${data.igLead.convertedQuoteLeadId}`} className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:underline">
                    <CheckCircle2 className="w-4 h-4" /> Converted → open quote lead <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            {/* The post it was left on */}
            {data?.media && (
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">The post</h3>
                <div className="flex gap-3">
                  {thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    {data.media.caption && <p className="text-sm text-gray-700 line-clamp-3">{data.media.caption}</p>}
                    {data.media.permalink && (
                      <a href={data.media.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-teal-600 hover:underline mt-1">
                        View on Instagram <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Their comment */}
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Their comment</h3>
              <p className="text-sm text-navy-900 bg-gray-50 rounded-lg p-3">“{dm.commentText}”</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{fmt(data?.comment?.timestamp || dm.createdAt)}</span>
                {typeof data?.comment?.like_count === "number" && (
                  <span className="inline-flex items-center gap-1"><Heart className="w-3.5 h-3.5" />{data.comment.like_count}</span>
                )}
                {dm.igUserId && <span className="text-gray-400">ID {dm.igUserId}</span>}
              </div>
            </section>

            {/* Our automated response */}
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Our auto-response</h3>
              <div className="flex items-center gap-2 flex-wrap mb-2 text-xs">
                {data?.campaign && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{data.campaign.name}</span>}
                {data?.matchedKeyword && <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700">matched “{data.matchedKeyword}”</span>}
              </div>
              <div className="flex gap-2 text-sm">
                <Send className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                <p className="text-gray-800 bg-teal-50/60 rounded-lg p-3 flex-1">{dm.dmText}</p>
              </div>
              <div className="mt-2 space-y-1 text-xs text-gray-500">
                <p>Status: <span className={statusBadge(dm.status)}>{dm.status.toLowerCase().replace("_", " ")}</span></p>
                {dm.sentAt && <p>Sent {fmt(dm.sentAt)}{latency && ` · ${latency} after the comment`}</p>}
                {dm.error && <p className="text-red-600">Error: {dm.error}</p>}
                {data?.campaign?.publicReply && <p>Public reply posted: “{data.campaign.publicReply}”</p>}
              </div>
            </section>

            {/* This person's history with us */}
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> History with you
              </h3>
              {data && data.historyCount > 0 ? (
                <>
                  <p className="text-xs text-gray-500 mb-2">
                    <MessageCircle className="w-3.5 h-3.5 inline mr-1" />
                    {data.historyCount} earlier {data.historyCount === 1 ? "interaction" : "interactions"} from this person.
                  </p>
                  <ul className="space-y-1.5">
                    {data.history.map((h) => (
                      <li key={h.id} className="flex items-center gap-2 text-xs">
                        <span className={statusBadge(h.status)}>{h.status.toLowerCase().replace("_", " ")}</span>
                        <span className="text-gray-600 truncate flex-1">“{h.commentText}”</span>
                        <span className="text-gray-400 whitespace-nowrap">{fmt(h.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-xs text-gray-400">First time this person has triggered a campaign.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
