"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  X,
  AlertCircle,
  Send,
  CheckCircle,
  AlertTriangle,
  Ban,
  Calendar,
  Eye,
  Trash2,
} from "lucide-react";

type InvoiceStatus = "DRAFT" | "OPEN" | "PAID" | "OVERDUE" | "VOID" | "UNCOLLECTIBLE";

interface InvoiceClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

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
  status: InvoiceStatus;
  totalCents: number;
  subtotalCents: number;
  taxCents: number;
  discountCents: number;
  amountPaidCents: number;
  amountDueCents: number;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  client: InvoiceClient | null;
  items: InvoiceItem[];
  itemCount: number;
}

interface ClientOption {
  id: string;
  name: string;
  email: string | null;
}

const INVOICE_STATUSES: InvoiceStatus[] = ["DRAFT", "OPEN", "OVERDUE", "PAID", "VOID", "UNCOLLECTIBLE"];

function getStatusIcon(status: InvoiceStatus) {
  switch (status) {
    case "DRAFT":
      return <FileText className="w-4 h-4 text-gray-500" />;
    case "OPEN":
      return <Send className="w-4 h-4 text-blue-500" />;
    case "PAID":
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case "OVERDUE":
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case "VOID":
      return <Ban className="w-4 h-4 text-gray-400" />;
    case "UNCOLLECTIBLE":
      return <AlertCircle className="w-4 h-4 text-red-500" />;
  }
}

function getStatusColor(status: InvoiceStatus) {
  switch (status) {
    case "DRAFT":
      return "text-gray-700 bg-gray-100";
    case "OPEN":
      return "text-blue-700 bg-blue-100";
    case "PAID":
      return "text-green-700 bg-green-100";
    case "OVERDUE":
      return "text-red-700 bg-red-100";
    case "VOID":
      return "text-gray-600 bg-gray-100";
    case "UNCOLLECTIBLE":
      return "text-red-700 bg-red-100";
  }
}

function getStatusLabel(status: InvoiceStatus) {
  switch (status) {
    case "UNCOLLECTIBLE":
      return "Failed";
    default:
      return status.charAt(0) + status.slice(1).toLowerCase();
  }
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default function InvoicesPage() {
  const searchParams = useSearchParams();
  const initialStatus = useMemo(() => searchParams.get("status") || "", []);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [clients, setClients] = useState<ClientOption[]>([]);

  // Form state
  const [form, setForm] = useState({
    clientId: "",
    dueDate: "",
    notes: "",
    taxRate: 0,
    discountCents: 0,
    items: [{ description: "", quantity: 1, unitPriceCents: 0 }],
  });

  useEffect(() => {
    fetchInvoices();
    fetchClients();
  }, [statusFilter, page]);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (searchQuery) params.set("search", searchQuery);
      params.set("page", page.toString());
      params.set("limit", "50");

      const res = await fetch(`/api/admin/invoices?${params}`);
      const data = await res.json();

      if (res.ok) {
        setInvoices(data.invoices || []);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        setError(data.error || "Failed to load invoices");
      }
    } catch (err) {
      console.error("Error fetching invoices:", err);
      setError("Failed to load invoices");
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

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchInvoices();
  }

  function openCreateModal() {
    setForm({
      clientId: "",
      dueDate: "",
      notes: "",
      taxRate: 0,
      discountCents: 0,
      items: [{ description: "", quantity: 1, unitPriceCents: 0 }],
    });
    setShowModal(true);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: form.clientId,
          dueDate: form.dueDate || null,
          notes: form.notes || null,
          taxRate: form.taxRate,
          discountCents: form.discountCents,
          items: form.items.filter((i) => i.description && i.unitPriceCents > 0),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchInvoices();
      } else {
        setError(data.error || "Failed to create invoice");
      }
    } catch (err) {
      console.error("Error creating invoice:", err);
      setError("Failed to create invoice");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(invoice: Invoice, newStatus: InvoiceStatus) {
    if (newStatus === "VOID" && !confirm("Are you sure you want to void this invoice?")) {
      return;
    }

    try {
      const method = newStatus === "VOID" ? "DELETE" : "PUT";
      const url =
        newStatus === "VOID"
          ? `/api/admin/invoices?id=${invoice.id}`
          : "/api/admin/invoices";
      const body = newStatus === "VOID" ? undefined : { id: invoice.id, status: newStatus };

      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to update status");
        return;
      }
      fetchInvoices();
      setShowDetailModal(false);
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update status");
    }
  }

  async function handleMarkPaid(invoice: Invoice) {
    if (!confirm("Mark this invoice as fully paid?")) return;

    try {
      const res = await fetch("/api/admin/invoices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invoice.id, paidCents: invoice.totalCents }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to mark as paid");
        return;
      }
      fetchInvoices();
      setShowDetailModal(false);
    } catch (err) {
      console.error("Error marking paid:", err);
      alert("Failed to mark as paid");
    }
  }

  function addItem() {
    setForm({
      ...form,
      items: [...form.items, { description: "", quantity: 1, unitPriceCents: 0 }],
    });
  }

  function removeItem(index: number) {
    setForm({
      ...form,
      items: form.items.filter((_, i) => i !== index),
    });
  }

  function updateItem(index: number, field: string, value: string | number) {
    const newItems = [...form.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setForm({ ...form, items: newItems });
  }

  const subtotal = form.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  const tax = Math.round(subtotal * (form.taxRate / 100));
  const total = subtotal + tax - form.discountCents;

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.client?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Compute stats from visible invoices only (use totalCents consistently so numbers add up)
  const visibleStats = useMemo(() => {
    const now = new Date();
    const result = {
      totalAmountCents: 0,
      draftAmountCents: 0,
      openAmountCents: 0,
      overdueAmountCents: 0,
      paidAmountCents: 0,
      failedAmountCents: 0,
    };
    for (const inv of filteredInvoices) {
      if (inv.status === "VOID") continue;
      const amount = inv.totalCents || 0;
      result.totalAmountCents += amount;
      switch (inv.status) {
        case "DRAFT":
          result.draftAmountCents += amount;
          break;
        case "OPEN":
          if (inv.dueDate && new Date(inv.dueDate) < now) {
            result.overdueAmountCents += amount;
          } else {
            result.openAmountCents += amount;
          }
          break;
        case "PAID":
          result.paidAmountCents += amount;
          break;
        case "UNCOLLECTIBLE":
          result.failedAmountCents += amount;
          break;
      }
    }
    return result;
  }, [filteredInvoices]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600">View and manage customer invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchInvoices}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Plus className="w-4 h-4" />
            Create Invoice
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5 flex items-stretch">
        {/* Left: Invoices Total */}
        <div className="flex flex-col justify-center pr-6 border-r border-gray-200 min-w-[180px]">
          <p className="text-sm font-medium text-gray-500 mb-1">Invoices Total</p>
          <p className="text-3xl font-bold text-teal-600">{formatCurrency(visibleStats.totalAmountCents)}</p>
        </div>

        {/* Right: Invoices by Status */}
        <div className="ml-auto">
          <p className="text-sm font-medium text-gray-500 mb-3">Invoices by Status</p>
          <div className="flex items-end gap-6">
            <button
              onClick={() => { setStatusFilter("DRAFT"); setPage(1); }}
              className="text-center hover:opacity-80 transition-opacity"
            >
              <div className="w-2 h-2 rounded-full bg-gray-400 mx-auto mb-1.5" />
              <p className="text-xs text-gray-500 mb-0.5">Draft</p>
              <p className="text-sm font-semibold text-gray-900">{formatCurrency(visibleStats.draftAmountCents)}</p>
            </button>
            <button
              onClick={() => { setStatusFilter("OPEN"); setPage(1); }}
              className="text-center hover:opacity-80 transition-opacity"
            >
              <div className="w-2 h-2 rounded-full bg-blue-500 mx-auto mb-1.5" />
              <p className="text-xs text-gray-500 mb-0.5">Open</p>
              <p className="text-sm font-semibold text-gray-900">{formatCurrency(visibleStats.openAmountCents)}</p>
            </button>
            <button
              onClick={() => { setStatusFilter("OVERDUE"); setPage(1); }}
              className="text-center hover:opacity-80 transition-opacity"
            >
              <div className="w-2 h-2 rounded-full bg-orange-500 mx-auto mb-1.5" />
              <p className="text-xs text-gray-500 mb-0.5">Overdue</p>
              <p className="text-sm font-semibold text-gray-900">{formatCurrency(visibleStats.overdueAmountCents)}</p>
            </button>
            <button
              onClick={() => { setStatusFilter("PAID"); setPage(1); }}
              className="text-center hover:opacity-80 transition-opacity"
            >
              <div className="w-2 h-2 rounded-full bg-green-500 mx-auto mb-1.5" />
              <p className="text-xs text-gray-500 mb-0.5">Paid</p>
              <p className="text-sm font-semibold text-gray-900">{formatCurrency(visibleStats.paidAmountCents)}</p>
            </button>
            <button
              onClick={() => { setStatusFilter("UNCOLLECTIBLE"); setPage(1); }}
              className="text-center hover:opacity-80 transition-opacity"
            >
              <div className="w-2 h-2 rounded-full bg-red-500 mx-auto mb-1.5" />
              <p className="text-xs text-gray-500 mb-0.5">Failed</p>
              <p className="text-sm font-semibold text-gray-900">{formatCurrency(visibleStats.failedAmountCents)}</p>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by invoice # or client..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">All Statuses</option>
            {INVOICE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {getStatusLabel(s)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Search
          </button>
        </form>
      </div>

      {/* Invoice List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No invoices found</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-teal-600 hover:text-teal-700 text-sm font-medium"
            >
              Create your first invoice
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Invoice
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Client
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{invoice.invoiceNumber}</p>
                        <p className="text-xs text-gray-500">{invoice.itemCount} item(s)</p>
                      </td>
                      <td className="px-4 py-3">
                        {invoice.client ? (
                          <div>
                            <p className="text-sm font-medium text-gray-900">{invoice.client.name}</p>
                            <p className="text-xs text-gray-500">{invoice.client.email}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Unknown</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(invoice.totalCents)}
                        </p>
                        {invoice.amountDueCents > 0 && invoice.status !== "DRAFT" && (
                          <p className="text-xs text-red-600">
                            Balance: {formatCurrency(invoice.amountDueCents)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            invoice.status
                          )}`}
                        >
                          {getStatusIcon(invoice.status)}
                          {getStatusLabel(invoice.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <p className="text-gray-900">
                            {invoice.createdAt
                              ? new Date(invoice.createdAt).toLocaleDateString()
                              : "Not issued"}
                          </p>
                          {invoice.dueDate && (
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Due: {new Date(invoice.dueDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/app/office/invoices/${invoice.id}`}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {invoice.status === "DRAFT" && (
                            <button
                              onClick={() => handleStatusChange(invoice, "OPEN")}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Send"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          {["OPEN", "OVERDUE"].includes(invoice.status) && (
                            <button
                              onClick={() => handleMarkPaid(invoice)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                              title="Mark Paid"
                            >
                              <CheckCircle className="w-4 h-4" />
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

      {/* Create Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-gray-900">Create Invoice</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* Client Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client *
                </label>
                <select
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select a client...</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} {client.email && `(${client.email})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">Line Items *</label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-sm text-teal-600 hover:text-teal-700"
                  >
                    + Add Item
                  </button>
                </div>
                <div className="space-y-3">
                  {form.items.map((item, index) => (
                    <div key={index} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(index, "description", e.target.value)}
                          placeholder="Description"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        />
                      </div>
                      <div className="w-20">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                          min="1"
                          placeholder="Qty"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        />
                      </div>
                      <div className="w-28">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                          <input
                            type="number"
                            value={item.unitPriceCents / 100 || ""}
                            onChange={(e) =>
                              updateItem(index, "unitPriceCents", Math.round(parseFloat(e.target.value) * 100) || 0)
                            }
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          />
                        </div>
                      </div>
                      <div className="w-24 text-right py-2 text-sm font-medium">
                        {formatCurrency(item.quantity * item.unitPriceCents)}
                      </div>
                      {form.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="p-2 text-gray-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tax & Discount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    value={form.taxRate}
                    onChange={(e) => setForm({ ...form, taxRate: parseFloat(e.target.value) || 0 })}
                    step="0.01"
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount ($)
                  </label>
                  <input
                    type="number"
                    value={form.discountCents / 100 || ""}
                    onChange={(e) =>
                      setForm({ ...form, discountCents: Math.round(parseFloat(e.target.value) * 100) || 0 })
                    }
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Totals */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                {form.taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax ({form.taxRate}%)</span>
                    <span className="font-medium">{formatCurrency(tax)}</span>
                  </div>
                )}
                {form.discountCents > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Discount</span>
                    <span className="font-medium text-red-600">-{formatCurrency(form.discountCents)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Additional notes for this invoice..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.clientId || total <= 0}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? "Creating..." : "Create Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
