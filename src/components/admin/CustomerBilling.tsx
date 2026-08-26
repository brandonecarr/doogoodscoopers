import { DollarSign, CalendarClock, Repeat, FileText, AlertTriangle } from "lucide-react";
import { fmtMoney, formatInterval, type CustomerBilling } from "@/lib/sweepandgo-billing";

/** "1 yr 3 mo" / "8 mo" / "12 days" from a start date. */
function tenure(start: Date | null): string {
  if (!start) return "—";
  const ms = Date.now() - new Date(start).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days < 31) return `${Math.max(days, 0)} day${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem ? `${years} yr ${rem} mo` : `${years} yr`;
}

function fmtShort(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * The value band at the top of a customer profile: what they pay, how long
 * they've been with us, and what they've paid us in total.
 */
export function BillingStats({ billing, startDate }: { billing: CustomerBilling; startDate: Date | null }) {
  const tiles = [
    {
      icon: Repeat,
      label: "Current rate",
      value: billing.rateCents !== null ? fmtMoney(billing.rateCents) : "—",
      sub: billing.rateCents !== null ? formatInterval(billing.rateInterval) : "no subscription invoice",
      tint: "#6D3EF0",
    },
    {
      icon: CalendarClock,
      label: "Customer for",
      value: tenure(startDate),
      sub: `since ${fmtShort(startDate)}`,
      tint: "#0EA5E9",
    },
    {
      icon: DollarSign,
      label: "Lifetime revenue",
      value: fmtMoney(billing.lifetimeCents),
      sub: `${billing.paymentCount} payment${billing.paymentCount === 1 ? "" : "s"} collected`,
      tint: "#16A34A",
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="dgs-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
                 style={{ background: `${t.tint}1A` }}>
              <t.icon className="w-5 h-5" style={{ color: t.tint }} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t.label}</p>
              <p className="text-[22px] font-extrabold text-navy-900 leading-tight tracking-[-0.02em]">{t.value}</p>
              <p className="text-[11.5px] text-gray-500 truncate">{t.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {billing.ambiguousName && (
        <p className="mt-2 text-[11.5px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 inline-flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>More than one customer record shares this name, and Sweep&amp;Go bills by name only — these totals may combine those records.</span>
        </p>
      )}
      {billing.noMatch && !billing.ambiguousName && (
        <p className="mt-2 text-[11.5px] text-gray-500">No Sweep&amp;Go billing records matched this name yet.</p>
      )}
    </div>
  );
}

const statusStyle = (s: string | null) => {
  const v = (s || "").toLowerCase();
  if (v === "paid") return "bg-green-100 text-green-800";
  if (v === "unpaid" || v === "overdue") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-700";
};

/** Full invoice history for this customer, newest first. */
export function InvoiceList({ billing }: { billing: CustomerBilling }) {
  const paidTotal = billing.invoices.reduce((n, i) => n + i.paidCents - i.refundedCents, 0);

  return (
    <div className="dgs-card p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <h2 className="text-lg font-semibold text-navy-900">Invoices</h2>
        </div>
        {billing.invoices.length > 0 && (
          <span className="text-[12px] text-gray-500">
            {billing.invoices.length} invoice{billing.invoices.length === 1 ? "" : "s"} · {fmtMoney(paidTotal)} paid
          </span>
        )}
      </div>

      {billing.invoices.length === 0 ? (
        <p className="text-sm text-gray-500">No invoices found for this customer.</p>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-100">
                <th className="px-2 py-2 font-semibold">Date</th>
                <th className="px-2 py-2 font-semibold">Type</th>
                <th className="px-2 py-2 font-semibold text-right">Amount</th>
                <th className="px-2 py-2 font-semibold text-right">Paid</th>
                <th className="px-2 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {billing.invoices.map((i) => (
                <tr key={i.invoiceNumber} className="border-b border-gray-50 last:border-0">
                  <td className="px-2 py-2.5 text-navy-900 whitespace-nowrap">{fmtShort(i.sngCreatedAt)}</td>
                  <td className="px-2 py-2.5 text-gray-600">
                    <span className="capitalize">{(i.type || "—").replace(/_/g, " ")}</span>
                    {i.billingInterval && i.type === "subscription" && (
                      <span className="text-gray-400"> · {formatInterval(i.billingInterval)}</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right text-navy-900 whitespace-nowrap">{fmtMoney(i.totalCents)}</td>
                  <td className="px-2 py-2.5 text-right whitespace-nowrap">
                    <span className={i.paidCents > 0 ? "text-green-700 font-medium" : "text-gray-400"}>{fmtMoney(i.paidCents)}</span>
                    {i.refundedCents > 0 && <span className="text-amber-700 block text-[11px]">−{fmtMoney(i.refundedCents)} refunded</span>}
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full capitalize ${statusStyle(i.status)}`}>{i.status || "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
