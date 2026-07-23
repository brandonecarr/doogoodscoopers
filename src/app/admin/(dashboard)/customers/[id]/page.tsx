import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Dog, Mail, Phone, MapPin, Calendar, RefreshCw, Repeat, User, Star, MessageSquare } from "lucide-react";
import prisma from "@/lib/prisma";
import { CustomerReviewControl } from "@/components/admin/CustomerReviewControl";
import { SendReviewRequestButton } from "@/components/admin/SendReviewRequestButton";

export const dynamic = "force-dynamic";

function fmtPhone(raw: string | null) {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}
function fmtDate(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
function fmtDateTime(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await prisma.sweepandgoCustomer.findUnique({ where: { id } });
  if (!customer) notFound();

  const [messages, review] = await Promise.all([
    prisma.leadMessage.findMany({ where: { leadType: "CUSTOMER", leadId: id }, orderBy: { createdAt: "asc" }, take: 100 }),
    prisma.review.findFirst({ where: { sngCustomerId: id }, orderBy: { createdAt: "desc" } }),
  ]);

  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "Unknown";

  const field = ({ icon: Icon, label, value, href }: { icon: typeof Mail; label: string; value: React.ReactNode; href?: string }) => (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-600" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-medium text-navy-900 break-words">
          {href && value ? <a href={href} className="hover:text-teal-600">{value}</a> : (value ?? <span className="text-gray-400">—</span>)}
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/customers" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-navy-900 truncate">{name}</h1>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${customer.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
              {customer.active ? "Active" : "Former"}
            </span>
          </div>
          <p className="text-navy-600 text-sm mt-1">Customer since {fmtDate(customer.startDate ?? customer.firstSeenAt)}</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
          <Dog className="w-6 h-6 text-teal-600" />
        </div>
      </div>

      {/* Contact */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-navy-900 mb-4">Contact</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field({ icon: Phone, label: "Cell phone", value: fmtPhone(customer.cellPhone), href: customer.cellPhone ? `tel:${customer.cellPhone}` : undefined })}
          {field({ icon: Phone, label: "Home phone", value: fmtPhone(customer.homePhone), href: customer.homePhone ? `tel:${customer.homePhone}` : undefined })}
          {field({ icon: Mail, label: "Email", value: customer.email, href: customer.email ? `mailto:${customer.email}` : undefined })}
          {field({ icon: MapPin, label: "Address", value: [customer.address, customer.zipCode].filter(Boolean).join(", ") })}
        </div>
      </div>

      {/* Service */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-navy-900 mb-4">Service</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field({ icon: Repeat, label: "Subscription", value: customer.subscriptionNames })}
          {field({ icon: Calendar, label: "Service day", value: customer.serviceDays })}
          {field({ icon: RefreshCw, label: "Frequency", value: customer.cleanupFrequency })}
          {field({ icon: User, label: "Assigned tech", value: customer.assignedTo })}
          {field({ icon: Calendar, label: "Start date", value: fmtDate(customer.startDate ?? customer.firstSeenAt) })}
          {field({ icon: Repeat, label: "One-time client", value: customer.oneTimeClient ? "Yes" : "No" })}
        </div>
      </div>

      {/* Review status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400" /> Review
          </h2>
          <div className="flex items-center gap-3">
            <CustomerReviewControl customerId={customer.id} value={customer.reviewStatus} size="md" />
            <SendReviewRequestButton customerId={customer.id} hasPhone={!!(customer.cellPhone || customer.homePhone)} />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Sends a Google review-request text to this customer and marks them <strong>Request Sent</strong>. Also set automatically when a review-request drip texts them. Update the status here anytime.
        </p>
        {review && (
          <div className="flex items-center gap-4 text-sm mt-4 pt-4 border-t border-gray-100">
            {review.rating ? <span className="text-amber-500">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span> : null}
            <span className="text-gray-500" suppressHydrationWarning>
              {review.status === "COMPLETED" ? `Reviewed on ${fmtDate(review.reviewedAt)}` : `Requested ${fmtDate(review.requestedAt)}`}
            </span>
          </div>
        )}
      </div>

      {/* Message history */}
      {messages.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-400" /> Messages ({messages.length})
          </h2>
          <div className="space-y-2">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.direction === "OUTBOUND" ? "bg-teal-600 text-white" : "bg-gray-100 text-navy-900"}`}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`text-[10px] mt-1 ${m.direction === "OUTBOUND" ? "text-teal-100" : "text-gray-400"}`} suppressHydrationWarning>
                    {fmtDateTime(m.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sync meta */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-xs text-gray-500 flex flex-wrap gap-x-6 gap-y-1">
        <span>Sweep&amp;Go ID: <code className="text-gray-600">{customer.sngId}</code></span>
        <span suppressHydrationWarning>First seen: {fmtDate(customer.firstSeenAt)}</span>
        <span suppressHydrationWarning>Last synced: {fmtDateTime(customer.lastSyncedAt)}</span>
        {!customer.active && <span suppressHydrationWarning>Archived: {fmtDate(customer.removedAt)}</span>}
      </div>
    </div>
  );
}
