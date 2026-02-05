"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, Edit, Ban, Printer, Mail, RefreshCw, DollarSign, Calendar, Hash } from "lucide-react";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  amountPaidCents: number;
  amountDueCents: number;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  billingOption: string | null;
  billingInterval: string | null;
  paymentMethod: string | null;
  subscriptionId: string | null;
  createdAt: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    address?: string | null;
  } | null;
  items: InvoiceItem[];
  defaultCard: { brand: string; last4: string } | null;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(dateString: string | null) {
  if (!dateString) return "No data";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getStatusColor(status: string) {
  switch (status) {
    case "DRAFT":
      return "text-orange-600";
    case "OPEN":
      return "text-blue-600";
    case "PAID":
      return "text-green-600";
    case "VOID":
      return "text-gray-500";
    case "FAILED":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "FAILED":
      return "FAILED";
    default:
      return status;
  }
}

function capitalizeCardBrand(brand: string) {
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Billing section state
  const [paymentMethod, setPaymentMethod] = useState<"card" | "check">("card");
  const [processing, setProcessing] = useState(false);
  const [checkForm, setCheckForm] = useState({
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    referenceNumber: "",
  });

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  async function fetchInvoice() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/invoices/${id}`);
      const data = await res.json();

      if (res.ok) {
        setInvoice(data.invoice);
        // Pre-fill amount with amount due
        if (data.invoice?.amountDueCents) {
          setCheckForm((prev) => ({
            ...prev,
            amount: (data.invoice.amountDueCents / 100).toFixed(2),
          }));
        }
      } else {
        setError(data.error || "Failed to load invoice");
      }
    } catch (err) {
      console.error("Error fetching invoice:", err);
      setError("Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }

  async function handleVoid() {
    if (!invoice || !confirm("Are you sure you want to void this invoice?")) return;

    try {
      const res = await fetch(`/api/admin/invoices?id=${invoice.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchInvoice();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to void invoice");
      }
    } catch (err) {
      console.error("Error voiding invoice:", err);
      alert("Failed to void invoice");
    }
  }

  async function handleDelete() {
    if (!invoice || !confirm("Are you sure you want to delete this invoice?")) return;

    try {
      const res = await fetch(`/api/admin/invoices?id=${invoice.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        window.location.href = "/app/office/invoices";
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete invoice");
      }
    } catch (err) {
      console.error("Error deleting invoice:", err);
      alert("Failed to delete invoice");
    }
  }

  async function handleChargeCard() {
    if (!invoice) return;

    if (!invoice.defaultCard) {
      alert("No payment method on file for this client");
      return;
    }

    if (!confirm(`Charge ${formatCurrency(invoice.amountDueCents)} to the card ending in ${invoice.defaultCard.last4}?`)) {
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/invoices/${invoice.id}/charge`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        alert("Payment successful!");
        fetchInvoice();
      } else {
        alert(data.error || "Failed to charge card");
      }
    } catch (err) {
      console.error("Error charging card:", err);
      alert("Failed to process payment");
    } finally {
      setProcessing(false);
    }
  }

  async function handleReceiveCheckPayment() {
    if (!invoice) return;

    const amountCents = Math.round(parseFloat(checkForm.amount) * 100);

    if (isNaN(amountCents) || amountCents <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (!checkForm.paymentDate) {
      alert("Please enter a payment date");
      return;
    }

    if (!checkForm.referenceNumber.trim()) {
      alert("Please enter a reference number");
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/invoices/${invoice.id}/check-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          paymentDate: checkForm.paymentDate,
          referenceNumber: checkForm.referenceNumber.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(data.fullyPaid ? "Payment recorded. Invoice marked as paid!" : "Payment recorded.");
        fetchInvoice();
        setCheckForm({ amount: "", paymentDate: new Date().toISOString().split("T")[0], referenceNumber: "" });
      } else {
        alert(data.error || "Failed to record payment");
      }
    } catch (err) {
      console.error("Error recording check payment:", err);
      alert("Failed to record payment");
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-6">
        <Link
          href="/app/office/invoices"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error || "Invoice not found"}
        </div>
      </div>
    );
  }

  const invoiceType = invoice.subscriptionId ? "SUBSCRIPTION" : "ONE TIME";
  const clientName = invoice.client
    ? `${invoice.client.firstName} ${invoice.client.lastName}`.trim()
    : "Unknown Client";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Invoice #: <span className="font-normal">{invoice.invoiceNumber}</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">{invoiceType}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/app/office/invoices"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>

          {invoice.status === "DRAFT" && (
            <>
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                <Trash2 className="w-4 h-4" />
                DELETE
              </button>
              <Link
                href={`/app/office/invoices/${invoice.id}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
              >
                <Edit className="w-4 h-4" />
                EDIT
              </Link>
            </>
          )}

          {(invoice.status === "PAID" || invoice.status === "OPEN" || invoice.status === "FAILED") && (
            <button
              onClick={handleVoid}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              <Ban className="w-4 h-4" />
              VOID
            </button>
          )}
        </div>
      </div>

      {/* Print/Email icons for non-draft */}
      {invoice.status !== "DRAFT" && (
        <div className="flex items-center gap-3">
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
            <Printer className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
            <Mail className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Summary</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {/* Row 1: Client | Date Created */}
          <div className="grid grid-cols-2">
            <div className="px-6 py-3 flex">
              <span className="text-gray-500 w-32">Client</span>
              <Link
                href={`/app/office/clients/${invoice.client?.id}`}
                className="text-teal-600 hover:text-teal-700 font-medium uppercase"
              >
                {clientName}
              </Link>
            </div>
            <div className="px-6 py-3 flex border-l border-gray-100">
              <span className="text-gray-500 w-40">Date Created</span>
              <span className="text-gray-900">{formatDate(invoice.createdAt)}</span>
            </div>
          </div>

          {/* Row 2: Address | Due Date */}
          <div className="grid grid-cols-2">
            <div className="px-6 py-3 flex">
              <span className="text-gray-500 w-32">Address</span>
              <span className="text-gray-900">{invoice.client?.address || "No address"}</span>
            </div>
            <div className="px-6 py-3 flex border-l border-gray-100">
              <span className="text-gray-500 w-40">Due Date</span>
              <span className={invoice.dueDate ? "text-gray-900" : "text-gray-400"}>
                {formatDate(invoice.dueDate)}
              </span>
            </div>
          </div>

          {/* Row 3: Email | Billing Option */}
          <div className="grid grid-cols-2">
            <div className="px-6 py-3 flex">
              <span className="text-gray-500 w-32">Email</span>
              <span className="text-gray-900">{invoice.client?.email || "No email"}</span>
            </div>
            <div className="px-6 py-3 flex border-l border-gray-100">
              <span className="text-gray-500 w-40">Billing Option</span>
              <span className="text-gray-900">{invoice.billingOption || "Variable"}</span>
            </div>
          </div>

          {/* Row 4: Net Terms | Billing Interval */}
          <div className="grid grid-cols-2">
            <div className="px-6 py-3 flex">
              <span className="text-gray-500 w-32">Net Terms</span>
              <span className="text-gray-900">NET 0</span>
            </div>
            <div className="px-6 py-3 flex border-l border-gray-100">
              <span className="text-gray-500 w-40">Billing Interval</span>
              <span className="text-gray-900">
                {invoice.billingInterval || (invoice.subscriptionId ? "Monthly" : "Once")}
              </span>
            </div>
          </div>

          {/* Row 5: Invoice # | Status */}
          <div className="grid grid-cols-2">
            <div className="px-6 py-3 flex">
              <span className="text-gray-500 w-32">Invoice #</span>
              <span className="text-gray-900">{invoice.invoiceNumber}</span>
            </div>
            <div className="px-6 py-3 flex border-l border-gray-100">
              <span className="text-gray-500 w-40">Status</span>
              <span className={`font-medium ${getStatusColor(invoice.status)}`}>
                {getStatusLabel(invoice.status)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Description</th>
              <th className="px-6 py-3 text-center text-sm font-medium text-gray-500">Quantity</th>
              <th className="px-6 py-3 text-right text-sm font-medium text-gray-500">Rate</th>
              <th className="px-6 py-3 text-right text-sm font-medium text-gray-500">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoice.items && invoice.items.length > 0 ? (
              invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-3 text-gray-900">{item.description}</td>
                  <td className="px-6 py-3 text-center text-gray-900">{item.quantity}</td>
                  <td className="px-6 py-3 text-right text-gray-900">
                    {formatCurrency(item.unit_price_cents)}
                  </td>
                  <td className="px-6 py-3 text-right text-gray-900">
                    {formatCurrency(item.total_cents)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                  No line items
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="border-t border-gray-200 px-6 py-4">
          <div className="flex flex-col items-end space-y-1">
            <div className="flex justify-between w-64">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-900">{formatCurrency(invoice.subtotalCents)}</span>
            </div>
            <div className="flex justify-between w-64">
              <span className="text-gray-500">Coupon</span>
              <span className="text-gray-900">{formatCurrency(invoice.discountCents)}</span>
            </div>
            <div className="flex justify-between w-64">
              <span className="text-gray-500">Tax</span>
              <span className="text-gray-900">{formatCurrency(invoice.taxCents)}</span>
            </div>
            <div className="flex justify-between w-64">
              <span className="text-gray-500">Tip</span>
              <span className="text-gray-900">{formatCurrency(invoice.tipCents || 0)}</span>
            </div>
            <div className="flex justify-between w-64 pt-2 border-t border-gray-200">
              <span className="font-semibold text-gray-900">Invoice Total</span>
              <span className="font-semibold text-gray-900">{formatCurrency(invoice.totalCents)}</span>
            </div>
            {(invoice.status === "PAID" || invoice.status === "FAILED" || invoice.amountPaidCents > 0) && (
              <>
                <div className="flex justify-between w-64">
                  <span className="text-gray-500">Amount Received</span>
                  <span className="text-gray-900">{formatCurrency(invoice.amountPaidCents)}</span>
                </div>
                <div className="flex justify-between w-64">
                  <span className="font-semibold text-gray-900">Remaining Balance</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(invoice.amountDueCents)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="border-t border-gray-200 px-6 py-4">
            <p className="text-gray-500">
              <span className="font-medium text-gray-700">Note to Client:</span> {invoice.notes}
            </p>
          </div>
        )}
      </div>

      {/* Billing Section - for unpaid invoices */}
      {(invoice.status === "OPEN" || invoice.status === "FAILED") && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Billing</h3>

          {/* Payment Method Options */}
          <div className="space-y-3">
            {/* Card Option */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="paymentMethod"
                checked={paymentMethod === "card"}
                onChange={() => setPaymentMethod("card")}
                className="w-4 h-4 text-teal-600 mt-0.5"
              />
              <div>
                <span className="text-gray-700 flex items-center gap-2">
                  Charge a payment method on file
                  {processing && paymentMethod === "card" && (
                    <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                  )}
                </span>
                <p className="text-sm text-gray-500 mt-1">
                  {invoice.defaultCard
                    ? `Credit Card: ${capitalizeCardBrand(invoice.defaultCard.brand)} **** ${invoice.defaultCard.last4}`
                    : "No card on file"}
                </p>
              </div>
            </label>

            {/* Check Option */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="paymentMethod"
                checked={paymentMethod === "check"}
                onChange={() => setPaymentMethod("check")}
                className="w-4 h-4 text-teal-600 mt-0.5"
              />
              <span className="text-gray-700">Receive check payment</span>
            </label>
          </div>

          {/* Check Payment Fields */}
          {paymentMethod === "check" && (
            <div className="mt-6 flex items-end gap-4">
              <div className="flex-1">
                <label className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <DollarSign className="w-4 h-4" />
                  Amount Received *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={checkForm.amount}
                  onChange={(e) => setCheckForm({ ...checkForm, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border-b-2 border-teal-500 focus:outline-none focus:border-teal-600 bg-transparent"
                />
              </div>
              <div className="flex-1">
                <label className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <Calendar className="w-4 h-4" />
                  Payment Date *
                </label>
                <input
                  type="date"
                  value={checkForm.paymentDate}
                  onChange={(e) => setCheckForm({ ...checkForm, paymentDate: e.target.value })}
                  className="w-full px-3 py-2 border-b-2 border-teal-500 focus:outline-none focus:border-teal-600 bg-transparent"
                />
              </div>
              <div className="flex-1">
                <label className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <Hash className="w-4 h-4" />
                  Reference Number *
                </label>
                <input
                  type="text"
                  value={checkForm.referenceNumber}
                  onChange={(e) => setCheckForm({ ...checkForm, referenceNumber: e.target.value })}
                  placeholder="Check #"
                  className="w-full px-3 py-2 border-b-2 border-teal-500 focus:outline-none focus:border-teal-600 bg-transparent"
                />
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="flex justify-end mt-6">
            {paymentMethod === "card" ? (
              <button
                onClick={handleChargeCard}
                disabled={processing || !invoice.defaultCard}
                className="text-teal-600 hover:text-teal-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? "PROCESSING..." : "CHARGE CLIENT"}
              </button>
            ) : (
              <button
                onClick={handleReceiveCheckPayment}
                disabled={processing}
                className="text-teal-600 hover:text-teal-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? "PROCESSING..." : "RECEIVE CHECK PAYMENT"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
