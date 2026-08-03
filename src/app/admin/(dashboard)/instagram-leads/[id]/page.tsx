import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Instagram, ExternalLink, CheckCircle2, Send, Clock, Heart } from "lucide-react";
import prisma from "@/lib/prisma";
import { fetchMediaInfo, fetchCommentInfo, trackedQuoteUrl } from "@/lib/instagram";
import { suggestQuotesForInstagramLead } from "@/lib/instagram-leads";
import { loadSendWindow } from "@/lib/send-window";
import { InstagramLeadControls } from "@/components/admin/InstagramLeadControls";
import { InstagramMatchButton } from "@/components/admin/InstagramMatchButton";

export const dynamic = "force-dynamic";

function fmt(d: Date | null | undefined, timeZone: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone, timeZoneName: "short" });
}

const STATUS_STYLE: Record<string, string> = {
  NEW: "bg-blue-50 text-blue-700",
  CONTACTED: "bg-indigo-50 text-indigo-700",
  NO_ANSWER: "bg-amber-50 text-amber-700",
  NOT_INTERESTED: "bg-gray-100 text-gray-600",
  WAITING_FOR_SIGNUP: "bg-purple-50 text-purple-700",
  CONVERTED: "bg-green-50 text-green-700",
};

export default async function InstagramLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.instagramLead.findUnique({ where: { id } });
  if (!lead) notFound();

  const { timeZone } = await loadSendWindow();
  const [quote, media, comment] = await Promise.all([
    lead.convertedQuoteLeadId ? prisma.quoteLead.findUnique({ where: { id: lead.convertedQuoteLeadId } }) : Promise.resolve(null),
    fetchMediaInfo(lead.mediaId),
    fetchCommentInfo(lead.commentId),
  ]);
  const suggestions = lead.convertedQuoteLeadId ? [] : await suggestQuotesForInstagramLead(lead);
  const clicks = await prisma.instagramLinkClick.findMany({
    where: { instagramLeadId: lead.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const trackedUrl = trackedQuoteUrl(lead.trackingCode);
  const permalink = (media as { permalink?: string } | null)?.permalink;
  const caption = (media as { caption?: string } | null)?.caption;
  const thumb = (media as { thumbnail_url?: string; media_url?: string } | null)?.thumbnail_url
    || (media as { media_url?: string } | null)?.media_url;
  const likeCount = (comment as { like_count?: number } | null)?.like_count;

  const card = "bg-white rounded-xl shadow-sm border border-gray-100 p-5";
  const labelCls = "text-xs font-semibold text-gray-500 uppercase tracking-wide";

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/admin/leads" className="p-2 hover:bg-gray-100 rounded-lg mt-0.5">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] flex items-center justify-center flex-shrink-0">
              <Instagram className="w-4 h-4 text-white" />
            </span>
            <h1 className="text-2xl font-bold text-navy-900 truncate">{lead.username ? `@${lead.username}` : "Instagram lead"}</h1>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLE[lead.status] || "bg-gray-100 text-gray-600"}`}>
              {lead.status.replace(/_/g, " ")}
            </span>
            {lead.convertedQuoteLeadId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> Converted
              </span>
            )}
          </div>
          <p className="text-navy-600 text-sm mt-1">
            First seen {fmt(lead.createdAt, timeZone)} · {lead.commentCount} matching {lead.commentCount === 1 ? "comment" : "comments"}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Conversion */}
          {quote ? (
            <div className={card + " border-green-200 bg-green-50/40"}>
              <h2 className="text-sm font-semibold text-navy-900 flex items-center gap-1.5 mb-3">
                <CheckCircle2 className="w-4 h-4 text-green-600" /> Converted to a quote lead
              </h2>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div><span className={labelCls}>Name</span><p className="text-navy-900">{[quote.firstName, quote.lastName].filter(Boolean).join(" ") || "—"}</p></div>
                <div><span className={labelCls}>Phone</span><p className="text-navy-900">{quote.phone || "—"}</p></div>
                <div><span className={labelCls}>Email</span><p className="text-navy-900">{quote.email || "—"}</p></div>
                <div><span className={labelCls}>Zip</span><p className="text-navy-900">{quote.zipCode || "—"}</p></div>
              </div>
              <Link href={`/admin/quote-leads/${quote.id}`} className="inline-flex items-center gap-1 text-sm text-teal-600 hover:underline mt-3">
                Open quote lead <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className={card}>
              <h2 className="text-sm font-semibold text-navy-900 mb-2">Not converted yet</h2>
              <p className="text-sm text-gray-500">This commenter hasn’t been matched to a quote. If they clicked the tracked link, any quote that landed soon after shows below as a likely match to confirm.</p>
            </div>
          )}

          {/* Possible conversions — quotes that landed soon after this lead clicked */}
          {suggestions.length > 0 && (
            <div className={card + " border-purple-200 bg-purple-50/40"}>
              <h2 className="text-sm font-semibold text-navy-900 mb-1">Possible conversions</h2>
              <p className="text-xs text-gray-500 mb-3">
                {lead.linkClickedAt ? "This lead clicked the quote link — " : ""}these quotes came in shortly after. Confirm a match to attribute it.
              </p>
              <div className="divide-y divide-purple-100">
                {suggestions.map((q) => (
                  <div key={q.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <Link href={`/admin/quote-leads/${q.id}`} className="text-sm font-medium text-navy-900 hover:text-teal-600 hover:underline">
                        {q.name}
                      </Link>
                      <p className="text-xs text-gray-500 truncate">
                        {q.phone || "no phone"}{q.zipCode ? ` · ${q.zipCode}` : ""} · {q.minutesAfterClick < 1 ? "under a minute" : `${q.minutesAfterClick} min`} after the click
                      </p>
                    </div>
                    <InstagramMatchButton instagramLeadId={lead.id} quoteLeadId={q.id} label="It's them" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Their comment / the post */}
          <div className={card}>
            <h2 className="text-sm font-semibold text-navy-900 mb-3">Comment & post</h2>
            {lead.campaignName && <p className="text-xs text-gray-500 mb-2">Campaign: <span className="text-gray-700">{lead.campaignName}</span></p>}
            {lead.commentText && <p className="text-sm text-navy-900 bg-gray-50 rounded-lg p-3">“{lead.commentText}”</p>}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{fmt(lead.lastCommentAt || lead.createdAt, timeZone)}</span>
              {typeof likeCount === "number" && <span className="inline-flex items-center gap-1"><Heart className="w-3.5 h-3.5" />{likeCount}</span>}
              {lead.igUserId && <span>ID {lead.igUserId}</span>}
            </div>
            {(thumb || caption || permalink) && (
              <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
                {thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
                )}
                <div className="min-w-0 flex-1">
                  {caption && <p className="text-sm text-gray-700 line-clamp-3">{caption}</p>}
                  {permalink && (
                    <a href={permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-teal-600 hover:underline mt-1">
                      View on Instagram <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Tracked link */}
          <div className={card}>
            <h2 className="text-sm font-semibold text-navy-900 flex items-center gap-1.5 mb-2"><Send className="w-4 h-4 text-teal-600" /> Tracked quote link</h2>
            <p className="text-xs text-gray-500 mb-2">The <code className="bg-gray-100 px-1 rounded">{"{link}"}</code> in this person’s DM points here. Clicks are logged, then forwarded to your onboarding form.</p>
            <a href={trackedUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-600 hover:underline break-all">{trackedUrl}</a>
            <div className="mt-3 pt-3 border-t border-gray-100 text-sm">
              {clicks.length > 0 ? (
                <>
                  <p className="inline-flex items-center gap-1.5 text-green-700 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Clicked {clicks.length}{clicks.length >= 50 ? "+" : ""}×
                  </p>
                  <ul className="mt-2 space-y-1">
                    {clicks.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 text-xs text-gray-600" suppressHydrationWarning>
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {fmt(c.createdAt, timeZone)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : lead.linkClickedAt ? (
                // Legacy: clicks predating per-click logging (only the counter + first time exist).
                <p className="inline-flex items-center gap-1.5 text-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  Clicked {lead.linkClickCount}× · first {fmt(lead.linkClickedAt, timeZone)}
                </p>
              ) : (
                <p className="text-gray-400">Not clicked yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Controls sidebar */}
        <div className="space-y-6">
          <InstagramLeadControls
            id={lead.id}
            initial={{
              status: lead.status,
              grade: lead.grade,
              followupDate: lead.followupDate ? lead.followupDate.toISOString() : null,
              notes: lead.notes,
              archived: lead.archived,
            }}
          />
        </div>
      </div>
    </div>
  );
}
