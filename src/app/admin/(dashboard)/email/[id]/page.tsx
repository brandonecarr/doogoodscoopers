import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Send, MousePointerClick, Eye, AlertTriangle, UserMinus, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import prisma from "@/lib/prisma";
import { EmailStatsSyncButton } from "@/components/admin/EmailStatsSyncButton";

export const dynamic = "force-dynamic";

function fmt(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function pct(n: number, d: number) {
  return d > 0 ? `${Math.round((n / d) * 1000) / 10}%` : "—";
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SCHEDULED: "bg-amber-100 text-amber-800",
  QUEUED: "bg-blue-100 text-blue-800",
  SENDING: "bg-blue-100 text-blue-800",
  SENT: "bg-green-100 text-green-800",
};
const R_STATUS: Record<string, { cls: string; label: string }> = {
  SENT: { cls: "bg-green-50 text-green-700", label: "Sent" },
  PENDING: { cls: "bg-gray-100 text-gray-600", label: "Pending" },
  FAILED: { cls: "bg-red-50 text-red-700", label: "Failed" },
  SKIPPED: { cls: "bg-amber-50 text-amber-700", label: "Skipped" },
};
const TYPE_LABEL: Record<string, string> = {
  quote: "Quote", ad: "Ad", outofarea: "Out of area", commercial: "Commercial", career: "Career", customer: "Customer", contact: "Subscriber",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function audienceSummary(filter: any): string {
  if (!filter || typeof filter !== "object") return "—";
  const parts: string[] = [];
  const typeLabels: Record<string, string> = { quote: "Quote leads", ad: "Ad leads", outofarea: "Out-of-area", commercial: "Commercial", career: "Careers", customers: "Customers", subscribers: "Subscribers" };
  if (Array.isArray(filter.leadTypes) && filter.leadTypes.length) parts.push(filter.leadTypes.map((t: string) => typeLabels[t] || t).join(", "));
  if (filter.withinDays) parts.push(`created in last ${filter.withinDays} days`);
  if (Array.isArray(filter.statuses) && filter.statuses.length) parts.push(`status: ${filter.statuses.join(", ").toLowerCase().replace(/_/g, " ")}`);
  const freq: Record<string, string> = { weekly: "weekly", biweekly: "every other week", twiceweekly: "2×/week", monthly: "monthly", other: "other" };
  if (Array.isArray(filter.customerFrequencies) && filter.customerFrequencies.length) parts.push(`freq: ${filter.customerFrequencies.map((f: string) => freq[f] || f).join(", ")}`);
  if (filter.customerAddon === "has") parts.push("has deodorizing add-on");
  if (filter.customerAddon === "none") parts.push("no deodorizing add-on");
  return parts.length ? parts.join(" · ") : "Everyone";
}

function Stat({ icon, label, value, sub, tone = "teal" }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: string }) {
  const tones: Record<string, string> = { teal: "text-teal-600 bg-teal-50", green: "text-green-600 bg-green-50", blue: "text-blue-600 bg-blue-50", amber: "text-amber-600 bg-amber-50", red: "text-red-600 bg-red-50", gray: "text-gray-500 bg-gray-100" };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${tones[tone]}`}>{icon}</span>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-navy-900 leading-none">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default async function EmailCampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.emailCampaign.findUnique({ where: { id } });
  if (!c) notFound();

  const recipients = await prisma.emailRecipient.findMany({
    where: { campaignId: id },
    orderBy: [{ status: "asc" }, { email: "asc" }],
    take: 1000,
  });
  const totalRecipients = await prisma.emailRecipient.count({ where: { campaignId: id } });

  const delivered = Math.max(0, c.sentCount - c.bounceCount);
  const sentAt = c.status === "SENT" ? c.updatedAt : null;

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <Link href="/admin/email" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy-900">
        <ArrowLeft className="w-4 h-4" /> Back to Email
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-navy-900 truncate">{c.name}</h1>
            <span className={`px-2 py-0.5 text-[11px] rounded ${STATUS_STYLES[c.status] || "bg-gray-100 text-gray-600"}`}>{c.status}</span>
          </div>
          <p className="text-navy-600 text-sm mt-1">{c.subject}</p>
        </div>
        <EmailStatsSyncButton campaignId={c.id} />
      </div>

      {/* Meta */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div><p className="text-xs text-gray-400">From</p><p className="text-navy-900">{c.fromName ? `${c.fromName} ` : ""}{c.fromEmail ? `<${c.fromEmail}>` : "default sender"}</p></div>
        <div><p className="text-xs text-gray-400">Reply-to</p><p className="text-navy-900">{c.replyTo || "—"}</p></div>
        <div><p className="text-xs text-gray-400">Created</p><p className="text-navy-900" suppressHydrationWarning>{fmt(c.createdAt)}</p></div>
        <div><p className="text-xs text-gray-400">{c.status === "SCHEDULED" ? "Scheduled" : "Sent"}</p><p className="text-navy-900" suppressHydrationWarning>{fmt(c.status === "SCHEDULED" ? c.scheduledAt : sentAt)}</p></div>
        <div className="col-span-2 md:col-span-4"><p className="text-xs text-gray-400">Audience</p><p className="text-navy-900">{audienceSummary(c.audienceFilter)}</p></div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat tone="gray" icon={<Mail className="w-4 h-4" />} label="Recipients" value={String(totalRecipients)} />
        <Stat tone="teal" icon={<Send className="w-4 h-4" />} label="Sent" value={String(c.sentCount)} sub={c.failedCount ? `${c.failedCount} failed` : undefined} />
        <Stat tone="green" icon={<Eye className="w-4 h-4" />} label="Opened" value={String(c.openCount)} sub={`${pct(c.openCount, delivered)} open rate`} />
        <Stat tone="blue" icon={<MousePointerClick className="w-4 h-4" />} label="Clicked" value={String(c.clickCount)} sub={`${pct(c.clickCount, delivered)} click rate · ${pct(c.clickCount, c.openCount)} CTOR`} />
        <Stat tone="teal" icon={<CheckCircle2 className="w-4 h-4" />} label="Delivered" value={String(delivered)} sub={`${pct(delivered, c.sentCount)} of sent`} />
        <Stat tone="amber" icon={<AlertTriangle className="w-4 h-4" />} label="Bounced" value={String(c.bounceCount)} sub={`${pct(c.bounceCount, c.sentCount)} of sent`} />
        <Stat tone="red" icon={<UserMinus className="w-4 h-4" />} label="Unsubscribed" value={String(c.unsubscribeCount)} />
        <Stat tone="gray" icon={<XCircle className="w-4 h-4" />} label="Failed" value={String(c.failedCount)} />
      </div>

      {/* Recipient breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-navy-900">Recipients</h2>
          <span className="text-xs text-gray-400">{recipients.length < totalRecipients ? `showing ${recipients.length} of ${totalRecipients}` : `${totalRecipients} total`}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="px-4 py-2 font-medium">Recipient</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-center">Opened</th>
                <th className="px-4 py-2 font-medium text-center">Clicked</th>
                <th className="px-4 py-2 font-medium">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recipients.map((r) => {
                const st = R_STATUS[r.status] || { cls: "bg-gray-100 text-gray-600", label: r.status };
                return (
                  <tr key={r.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2">
                      <p className="text-navy-900 truncate max-w-[220px]">{r.name || r.email}</p>
                      {r.name && <p className="text-xs text-gray-400 truncate max-w-[220px]">{r.email}</p>}
                      {r.error && <p className="text-xs text-red-500 truncate max-w-[220px]">{r.error}</p>}
                    </td>
                    <td className="px-4 py-2 text-gray-500">{TYPE_LABEL[r.contactType || ""] || r.contactType || "—"}</td>
                    <td className="px-4 py-2"><span className={`px-1.5 py-0.5 text-[11px] rounded ${st.cls}`}>{st.label}</span></td>
                    <td className="px-4 py-2 text-center">{r.openedAt ? <CheckCircle2 className="w-4 h-4 text-green-500 inline" /> : <MinusCircle className="w-3.5 h-3.5 text-gray-200 inline" />}</td>
                    <td className="px-4 py-2 text-center">{r.clickedAt ? <CheckCircle2 className="w-4 h-4 text-blue-500 inline" /> : <MinusCircle className="w-3.5 h-3.5 text-gray-200 inline" />}</td>
                    <td className="px-4 py-2 text-gray-400 whitespace-nowrap" suppressHydrationWarning>{r.sentAt ? fmt(r.sentAt) : "—"}</td>
                  </tr>
                );
              })}
              {recipients.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No recipients yet. Recipients are built when the blast is sent or scheduled.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email preview */}
      <details className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-navy-900 select-none">Email preview</summary>
        <div className="border-t border-gray-100 bg-gray-50 p-4">
          <iframe title="Email preview" srcDoc={c.html} className="w-full h-[600px] bg-white rounded-lg border border-gray-200" />
        </div>
      </details>
    </div>
  );
}
