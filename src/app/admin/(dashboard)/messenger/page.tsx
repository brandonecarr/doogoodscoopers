import prisma from "@/lib/prisma";
import { MessageCircle, Facebook } from "lucide-react";
import { isMessengerConfigured } from "@/lib/messenger";

export const dynamic = "force-dynamic";

function fmt(d: Date | null) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function initials(name: string | null) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

export default async function MessengerPage() {
  const convos = await prisma.messengerLead.findMany({
    where: { archived: false },
    orderBy: [{ lastMessageAt: "desc" }],
    take: 100,
  });
  const ids = convos.map((c) => c.id);
  const messages = ids.length
    ? await prisma.leadMessage.findMany({
        where: { leadType: "MESSENGER", leadId: { in: ids } },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const byLead = new Map<string, typeof messages>();
  for (const m of messages) {
    const arr = byLead.get(m.leadId) || [];
    arr.push(m);
    byLead.set(m.leadId, arr);
  }
  const unreadCount = convos.filter((c) => c.unread).length;
  const configured = isMessengerConfigured();

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <Facebook className="w-6 h-6 text-[#0866ff]" /> Facebook Messenger
          </h1>
          <p className="text-navy-600 text-sm mt-1">Messages customers send your Facebook Page land here.</p>
        </div>
        {unreadCount > 0 && (
          <span className="px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 text-sm font-semibold">{unreadCount} unread</span>
        )}
      </div>

      {!configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <b>Not connected yet.</b> Add your Meta app credentials (<code className="bg-white px-1 rounded">MESSENGER_PAGE_TOKEN</code>,
          {" "}<code className="bg-white px-1 rounded">MESSENGER_VERIFY_TOKEN</code>, <code className="bg-white px-1 rounded">META_APP_SECRET</code>)
          in your environment and point the Meta webhook at <code className="bg-white px-1 rounded">/api/webhooks/messenger</code>. Messages will start appearing here automatically.
        </div>
      )}

      {convos.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No Facebook messages yet.</p>
          <p className="text-gray-400 text-sm mt-1">When a customer messages your Page, the conversation shows up here and a notification is sent to your phone.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {convos.map((c) => {
            const thread = byLead.get(c.id) || [];
            return (
              <div key={c.id} className={`bg-white rounded-xl shadow-sm border ${c.unread ? "border-teal-300" : "border-gray-100"} overflow-hidden`}>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <div className="w-10 h-10 rounded-full bg-[#0866ff]/10 text-[#0866ff] font-bold flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {c.profilePicUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.profilePicUrl} alt={c.name || "Contact"} className="w-full h-full object-cover" />
                    ) : (
                      initials(c.name)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-navy-900 truncate">{c.name || "Facebook user"}</span>
                      {c.unread && <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" title="Unread" />}
                    </div>
                    <span className="text-xs text-gray-400" suppressHydrationWarning>{fmt(c.lastMessageAt)}</span>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-2 bg-gray-50/60 max-h-72 overflow-y-auto">
                  {thread.length === 0 ? (
                    <p className="text-sm text-gray-600">{c.lastMessage}</p>
                  ) : (
                    thread.map((m) => (
                      <div key={m.id} className={`flex ${m.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${m.direction === "OUTBOUND" ? "bg-teal-600 text-white" : "bg-white border border-gray-200 text-navy-900"}`}>
                          {m.body}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
