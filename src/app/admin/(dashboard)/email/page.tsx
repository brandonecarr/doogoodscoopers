import Link from "next/link";
import { Mail, Plus, Send, Clock, CheckCircle2, FileText } from "lucide-react";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SCHEDULED: "bg-amber-100 text-amber-800",
  QUEUED: "bg-blue-100 text-blue-800",
  SENDING: "bg-blue-100 text-blue-800",
  SENT: "bg-green-100 text-green-800",
};

function pct(n: number, d: number) {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : "—";
}

export default async function EmailPage() {
  const campaigns = await prisma.emailCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Email</h1>
          <p className="text-navy-600 text-sm mt-1">Newsletters &amp; broadcasts to your contacts.</p>
        </div>
        <Link href="/admin/email/new" className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium">
          <Plus className="w-4 h-4" />
          New Email
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Mail className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No emails yet.</p>
          <Link href="/admin/email/new" className="text-teal-600 text-sm font-medium hover:underline mt-2 inline-block">Compose your first email →</Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          {campaigns.map((c) => (
            <div key={c.id} className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                {c.status === "SENT" ? <CheckCircle2 className="w-5 h-5 text-teal-600" /> : c.status === "SENDING" || c.status === "QUEUED" ? <Send className="w-5 h-5 text-teal-600" /> : c.status === "SCHEDULED" ? <Clock className="w-5 h-5 text-teal-600" /> : <FileText className="w-5 h-5 text-teal-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-navy-900 truncate">{c.name}</span>
                  <span className={`px-1.5 py-0.5 text-[10px] rounded ${STATUS_STYLES[c.status] || "bg-gray-100 text-gray-600"}`}>{c.status}</span>
                </div>
                <p className="text-sm text-gray-500 truncate">{c.subject}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-500">
                  {c.sentCount}/{c.totalRecipients} sent
                  {c.status === "SENT" && c.sentCount > 0 ? ` · ${pct(c.openCount, c.sentCount)} open · ${pct(c.clickCount, c.sentCount)} click` : ""}
                </p>
                <p className="text-xs text-gray-400" suppressHydrationWarning>{fmtDate(c.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
