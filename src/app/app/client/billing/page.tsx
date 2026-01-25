"use client";

import { useState, useEffect } from "react";
import {
  CreditCard,
  FileText,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  Gift,
  Loader2,
} from "lucide-react";

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  dueDate: string;
  createdAt: string;
  paidAt: string | null;
}

interface Payment {
  id: string;
  amountCents: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
  invoiceNumber: string | null;
}

interface PaymentMethod {
  id: string;
  type: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
}

interface Totals {
  totalBilled: number;
  totalPaid: number;
  openBalance: number;
  accountCredit: number;
  giftCertBalance: number;
}

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [totals, setTotals] = useState<Totals>({
    totalBilled: 0,
    totalPaid: 0,
    openBalance: 0,
    accountCredit: 0,
    giftCertBalance: 0,
  });
  const [hasStripeCustomer, setHasStripeCustomer] = useState(false);

  useEffect(() => {
    async function fetchBilling() {
      try {
        const res = await fetch("/api/client/billing");
        const data = await res.json();

        if (res.ok) {
          setInvoices(data.invoices || []);
          setPayments(data.payments || []);
          setPaymentMethods(data.paymentMethods || []);
          setTotals(data.totals);
          setHasStripeCustomer(data.hasStripeCustomer);
        } else {
          setError(data.error || "Failed to load billing");
        }
      } catch (err) {
        console.error("Error fetching billing:", err);
        setError("Failed to load billing");
      } finally {
        setLoading(false);
      }
    }

    fetchBilling();
  }, []);

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return { color: "bg-green-100 text-green-700", icon: CheckCircle };
      case "UNPAID":
        return { color: "bg-yellow-100 text-yellow-700", icon: Clock };
      case "OVERDUE":
        return { color: "bg-red-100 text-red-700", icon: AlertCircle };
      default:
        return { color: "bg-gray-100 text-gray-700", icon: FileText };
    }
  };

  const getCardBrandColor = (brand: string | null) => {
    const brandLower = brand?.toLowerCase() || "";
    const brandColors: Record<string, string> = {
      visa: "bg-blue-600",
      mastercard: "bg-red-500",
      amex: "bg-blue-400",
      discover: "bg-orange-500",
    };
    return brandColors[brandLower] || "bg-gray-600";
  };

  const handlePayNow = async () => {
    if (!hasStripeCustomer || totals.openBalance <= 0) return;

    setPaying(true);
    setError(null);

    try {
      const res = await fetch("/api/client/billing/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: totals.openBalance }),
      });

      const data = await res.json();

      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to initiate payment");
      }
    } catch (err) {
      console.error("Payment error:", err);
      setError("Failed to initiate payment");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-xl font-bold text-gray-900">Billing & Payments</h1>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Balance Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <DollarSign className="w-4 h-4" />
            Open Balance
          </div>
          <p className={`text-2xl font-bold ${totals.openBalance > 0 ? "text-red-600" : "text-gray-900"}`}>
            {formatCurrency(totals.openBalance)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <CreditCard className="w-4 h-4" />
            Account Credit
          </div>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(totals.accountCredit)}
          </p>
        </div>
      </div>

      {/* Gift Certificate Balance */}
      {totals.giftCertBalance > 0 && (
        <div className="bg-purple-50 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <Gift className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="font-medium text-purple-800">Gift Certificate Balance</p>
            <p className="text-sm text-purple-700">
              {formatCurrency(totals.giftCertBalance)} available
            </p>
          </div>
        </div>
      )}

      {/* Pay Now Button (if has balance) */}
      {totals.openBalance > 0 && hasStripeCustomer && (
        <button
          onClick={handlePayNow}
          disabled={paying}
          className="w-full bg-teal-600 text-white rounded-xl py-3 font-medium flex items-center justify-center gap-2 hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          {paying ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              Pay {formatCurrency(totals.openBalance)} Now
            </>
          )}
        </button>
      )}

      {/* Invoices */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Invoices</h2>
        </div>

        {invoices.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No invoices yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {invoices.map((invoice) => {
              const status = getInvoiceStatusBadge(invoice.status);
              const StatusIcon = status.icon;

              return (
                <div key={invoice.id} className="p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">#{invoice.invoiceNumber}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {invoice.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{formatDate(invoice.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(invoice.totalCents)}</p>
                    {invoice.balanceCents > 0 && invoice.balanceCents !== invoice.totalCents && (
                      <p className="text-sm text-red-600">Due: {formatCurrency(invoice.balanceCents)}</p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 ml-2" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Payments */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Payments</h2>
        </div>

        {payments.length === 0 ? (
          <div className="p-8 text-center">
            <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No payments yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {payments.map((payment) => (
              <div key={payment.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{formatCurrency(payment.amountCents)}</p>
                  <p className="text-sm text-gray-500">
                    {formatDate(payment.createdAt)}
                    {payment.invoiceNumber && ` · Invoice #${payment.invoiceNumber}`}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <CheckCircle className="w-3 h-3" />
                  {payment.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Methods */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Payment Methods</h2>
          <button className="text-sm text-teal-600 font-medium">+ Add</button>
        </div>
        <div className="p-4 space-y-3">
          {paymentMethods.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No payment methods on file</p>
          ) : (
            paymentMethods.map((pm) => (
              <div key={pm.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className={`w-10 h-10 ${getCardBrandColor(pm.brand)} rounded flex items-center justify-center`}>
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {pm.brand?.toUpperCase() || "Card"} •••• {pm.last4}
                  </p>
                  <p className="text-sm text-gray-500">
                    Expires {pm.expMonth}/{pm.expYear}
                  </p>
                </div>
                {pm.isDefault && (
                  <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    Default
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
