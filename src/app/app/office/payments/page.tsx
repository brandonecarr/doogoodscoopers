"use client";

import { useState, useEffect } from "react";
import {
  DollarSign,
  Plus,
  Search,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
  Ban,
  CreditCard,
  Banknote,
  Building,
  RotateCcw,
  FileText,
  Eye,
  Calendar,
} from "lucide-react";

type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" | "PARTIAL_REFUND";
type PaymentMethod = "CARD" | "CASH" | "CHECK" | "ACH" | "OTHER";

interface PaymentClient {
  id: string;
  name: string;
  email: string | null;
}

interface PaymentInvoice {
  id: string;
  invoiceNumber: string;
  totalCents: number;
}

interface Payment {
  id: string;
  amountCents: number;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  stripePaymentIntentId: string | null;
  referenceNumber: string | null;
  refundAmountCents: number;
  refundReason: string | null;
  refundedAt: string | null;
  notes: string | null;
  createdAt: string;
  client: PaymentClient | null;
  invoice: PaymentInvoice | null;
}

interface PaymentStats {
  total: number;
  completed: number;
  pending: number;
  failed: number;
  refunded: number;
  totalCollectedCents: number;
  totalRefundedCents: number;
  netRevenueCents: number;
  byMethod: {
    card: number;
    cash: number;
    check: number;
    ach: number;
  };
}

interface ClientOption {
  id: string;
  name: string;
  email: string | null;
}

interface InvoiceOption {
  id: string;
  invoiceNumber: string;
  balanceCents: number;
}

const PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "COMPLETED", "FAILED", "REFUNDED", "PARTIAL_REFUND"];
const PAYMENT_METHODS: PaymentMethod[] = ["CARD", "CASH", "CHECK", "ACH", "OTHER"];

function getStatusIcon(status: PaymentStatus) {
  switch (status) {
    case "PENDING":
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case "COMPLETED":
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case "FAILED":
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case "REFUNDED":
      return <RotateCcw className="w-4 h-4 text-gray-500" />;
    case "PARTIAL_REFUND":
      return <RotateCcw className="w-4 h-4 text-orange-500" />;
  }
}

function getStatusColor(status: PaymentStatus) {
  switch (status) {
    case "PENDING":
      return "text-yellow-700 bg-yellow-100";
    case "COMPLETED":
      return "text-green-700 bg-green-100";
    case "FAILED":
      return "text-red-700 bg-red-100";
    case "REFUNDED":
      return "text-gray-700 bg-gray-100";
    case "PARTIAL_REFUND":
      return "text-orange-700 bg-orange-100";
  }
}

function getMethodIcon(method: PaymentMethod) {
  switch (method) {
    case "CARD":
      return <CreditCard className="w-4 h-4" />;
    case "CASH":
      return <Banknote className="w-4 h-4" />;
    case "CHECK":
      return <FileText className="w-4 h-4" />;
    case "ACH":
      return <Building className="w-4 h-4" />;
    default:
      return <DollarSign className="w-4 h-4" />;
  }
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default function PaymentsPage() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats>({
    total: 0,
    completed: 0,
    pending: 0,
    failed: 0,
    refunded: 0,
    totalCollectedCents: 0,
    totalRefundedCents: 0,
    netRevenueCents: 0,
    byMethod: { card: 0, cash: 0, check: 0, ach: 0 },
  });
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);

  // Form state
  const [form, setForm] = useState({
    clientId: "",
    invoiceId: "",
    amountCents: 0,
    paymentMethod: "CARD" as PaymentMethod,
    referenceNumber: "",
    notes: "",
  });

  // Refund form state
  const [refundForm, setRefundForm] = useState({
    refundAmountCents: 0,
    refundReason: "",
  });

  useEffect(() => {
    fetchPayments();
    fetchClients();
  }, [statusFilter, methodFilter, startDate, endDate, page]);

  async function fetchPayments() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (methodFilter) params.set("method", methodFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("page", page.toString());
      params.set("limit", "50");

      const res = await fetch(`/api/admin/payments?${params}`);
      const data = await res.json();

      if (res.ok) {
        setPayments(data.payments || []);
        setStats(data.stats || {});
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        setError(data.error || "Failed to load payments");
      }
    } catch (err) {
      console.error("Error fetching payments:", err);
      setError("Failed to load payments");
    } finally {
      setLoading(false);
    }
  }

  async function fetchClients() {
    try {
      const res = await fetch("/api/admin/clients?status=ACTIVE&limit=500");
      const data = await res.json();
      if (res.ok) {
        setClients(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.clients || []).map((c: any) => ({
            id: c.id,
            name: c.fullName,
            email: c.email,
          }))
        );
      }
    } catch (err) {
      console.error("Error fetching clients:", err);
    }
  }

  async function fetchInvoicesForClient(clientId: string) {
    if (!clientId) {
      setInvoices([]);
      return;
    }
    try {
      const res = await fetch(`/api/admin/invoices?clientId=${clientId}&status=SENT`);
      const data = await res.json();
      if (res.ok) {
        setInvoices(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.invoices || []).filter((inv: any) => inv.balanceCents > 0).map((inv: any) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            balanceCents: inv.balanceCents,
          }))
        );
      }
    } catch (err) {
      console.error("Error fetching invoices:", err);
    }
  }

  function openCreateModal() {
    setForm({
      clientId: "",
      invoiceId: "",
      amountCents: 0,
      paymentMethod: "CARD",
      referenceNumber: "",
      notes: "",
    });
    setInvoices([]);
    setShowModal(true);
    setError(null);
  }

  function openRefundModal(payment: Payment) {
    setSelectedPayment(payment);
    setRefundForm({
      refundAmountCents: payment.amountCents - payment.refundAmountCents,
      refundReason: "",
    });
    setShowRefundModal(true);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: form.clientId,
          invoiceId: form.invoiceId || null,
          amountCents: form.amountCents,
          paymentMethod: form.paymentMethod,
          referenceNumber: form.referenceNumber || null,
          notes: form.notes || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchPayments();
      } else {
        setError(data.error || "Failed to record payment");
      }
    } catch (err) {
      console.error("Error recording payment:", err);
      setError("Failed to record payment");
    } finally {
      setSaving(false);
    }
  }

  async function handleRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPayment) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedPayment.id,
          refundAmountCents: refundForm.refundAmountCents,
          refundReason: refundForm.refundReason || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setShowRefundModal(false);
        fetchPayments();
      } else {
        setError(data.error || "Failed to process refund");
      }
    } catch (err) {
      console.error("Error processing refund:", err);
      setError("Failed to process refund");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-600">Track payment history and outstanding balances</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPayments}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Plus className="w-4 h-4" />
            Record Payment
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Collected</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalCollectedCents)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Refunded</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalRefundedCents)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Net Revenue</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.netRevenueCents)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Payments</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-4">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">All Statuses</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace("_", " ")}
              </option>
            ))}
          </select>
          <select
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">All Methods</option>
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          {(statusFilter || methodFilter || startDate || endDate) && (
            <button
              onClick={() => {
                setStatusFilter("");
                setMethodFilter("");
                setStartDate("");
                setEndDate("");
                setPage(1);
              }}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Payment List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No payments found</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-teal-600 hover:text-teal-700 text-sm font-medium"
            >
              Record your first payment
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Client
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Method
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Invoice
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-900">
                          {new Date(payment.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(payment.createdAt).toLocaleTimeString()}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {payment.client ? (
                          <div>
                            <p className="text-sm font-medium text-gray-900">{payment.client.name}</p>
                            <p className="text-xs text-gray-500">{payment.client.email}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Unknown</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(payment.amountCents)}
                        </p>
                        {payment.refundAmountCents > 0 && (
                          <p className="text-xs text-red-600">
                            Refunded: {formatCurrency(payment.refundAmountCents)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                          {getMethodIcon(payment.paymentMethod)}
                          {payment.paymentMethod}
                        </span>
                        {payment.referenceNumber && (
                          <p className="text-xs text-gray-400">Ref: {payment.referenceNumber}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            payment.status
                          )}`}
                        >
                          {getStatusIcon(payment.status)}
                          {payment.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {payment.invoice ? (
                          <p className="text-sm text-gray-600">{payment.invoice.invoiceNumber}</p>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {payment.status === "COMPLETED" &&
                            payment.refundAmountCents < payment.amountCents && (
                              <button
                                onClick={() => openRefundModal(payment)}
                                className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg"
                                title="Refund"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Record Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client *
                </label>
                <select
                  value={form.clientId}
                  onChange={(e) => {
                    setForm({ ...form, clientId: e.target.value, invoiceId: "" });
                    fetchInvoicesForClient(e.target.value);
                  }}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select a client...</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              {invoices.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apply to Invoice (Optional)
                  </label>
                  <select
                    value={form.invoiceId}
                    onChange={(e) => {
                      const selectedInvoice = invoices.find((inv) => inv.id === e.target.value);
                      setForm({
                        ...form,
                        invoiceId: e.target.value,
                        amountCents: selectedInvoice?.balanceCents || form.amountCents,
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="">No invoice</option>
                    {invoices.map((invoice) => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.invoiceNumber} - Balance: {formatCurrency(invoice.balanceCents)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    value={form.amountCents / 100 || ""}
                    onChange={(e) =>
                      setForm({ ...form, amountCents: Math.round(parseFloat(e.target.value) * 100) || 0 })
                    }
                    step="0.01"
                    min="0"
                    required
                    className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method *
                </label>
                <select
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference Number
                </label>
                <input
                  type="text"
                  value={form.referenceNumber}
                  onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                  placeholder="Check #, transaction ID, etc."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.clientId || form.amountCents <= 0}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Process Refund</h2>
              <button
                onClick={() => setShowRefundModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRefund} className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Original Payment</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(selectedPayment.amountCents)}
                </p>
                {selectedPayment.refundAmountCents > 0 && (
                  <p className="text-sm text-orange-600">
                    Already refunded: {formatCurrency(selectedPayment.refundAmountCents)}
                  </p>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  Available for refund:{" "}
                  {formatCurrency(selectedPayment.amountCents - selectedPayment.refundAmountCents)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Refund Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    value={refundForm.refundAmountCents / 100 || ""}
                    onChange={(e) =>
                      setRefundForm({
                        ...refundForm,
                        refundAmountCents: Math.round(parseFloat(e.target.value) * 100) || 0,
                      })
                    }
                    step="0.01"
                    min="0"
                    max={(selectedPayment.amountCents - selectedPayment.refundAmountCents) / 100}
                    required
                    className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason
                </label>
                <textarea
                  value={refundForm.refundReason}
                  onChange={(e) => setRefundForm({ ...refundForm, refundReason: e.target.value })}
                  rows={2}
                  placeholder="Reason for refund..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || refundForm.refundAmountCents <= 0}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? "Processing..." : "Process Refund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
