"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

interface InvoiceItem {
  id?: string;
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
  totalCents: number;
  dueDate: string | null;
  notes: string | null;
  internalMemo?: string | null;
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
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(dateString: string | null) {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable state
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [noteToClient, setNoteToClient] = useState("");
  const [internalMemo, setInternalMemo] = useState("");

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
        // Initialize editable state
        setItems(data.invoice.items || []);
        setNoteToClient(data.invoice.notes || "");
        setInternalMemo(data.invoice.internalMemo || "");
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

  function addNewItem() {
    setItems([
      ...items,
      {
        description: "",
        quantity: 1,
        unit_price_cents: 0,
        total_cents: 0,
      },
    ]);
  }

  function updateItem(index: number, field: keyof InvoiceItem, value: unknown) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    // Recalculate total for quantity/rate changes
    if (field === "quantity" || field === "unit_price_cents") {
      updated[index].total_cents =
        updated[index].quantity * updated[index].unit_price_cents;
    }

    setItems(updated);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  // Calculate totals
  const subtotalCents = items.reduce((sum, item) => sum + item.total_cents, 0);
  const taxRate = 0; // Could be made configurable
  const taxCents = Math.round(subtotalCents * (taxRate / 100));
  const discountCents = invoice?.discountCents || 0;
  const totalCents = subtotalCents + taxCents - discountCents;

  async function handleSave(finalize: boolean = false) {
    if (items.length === 0 || items.every((item) => !item.description.trim())) {
      alert("Please add at least one line item with a description");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/invoices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            id: item.id,
            description: item.description,
            quantity: item.quantity,
            unitPriceCents: item.unit_price_cents,
          })),
          notes: noteToClient || null,
          internalMemo: internalMemo || null,
          finalize,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push(`/app/office/invoices/${id}`);
      } else {
        alert(data.error || "Failed to save invoice");
      }
    } catch (err) {
      console.error("Error saving invoice:", err);
      alert("Failed to save invoice");
    } finally {
      setSaving(false);
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

  if (invoice.status !== "DRAFT") {
    return (
      <div className="space-y-6">
        <Link
          href={`/app/office/invoices/${id}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoice
        </Link>
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg">
          Only draft invoices can be edited. This invoice is {invoice.status.toLowerCase()}.
        </div>
      </div>
    );
  }

  const clientName = invoice.client
    ? `${invoice.client.firstName} ${invoice.client.lastName}`.trim()
    : "Unknown Client";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Invoice</h1>
          <p className="text-sm text-gray-500 mt-1">
            Invoice #{invoice.invoiceNumber}
          </p>
        </div>
        <Link
          href={`/app/office/invoices/${id}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      {/* Summary Card (Read-only) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Summary</h2>
        </div>
        <div className="divide-y divide-gray-100">
          <div className="grid grid-cols-2">
            <div className="px-6 py-3 flex">
              <span className="text-gray-500 w-32">Client</span>
              <span className="text-gray-900 font-medium uppercase">{clientName}</span>
            </div>
            <div className="px-6 py-3 flex border-l border-gray-100">
              <span className="text-gray-500 w-40">Date Created</span>
              <span className="text-gray-900">{formatDate(invoice.createdAt)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2">
            <div className="px-6 py-3 flex">
              <span className="text-gray-500 w-32">Address</span>
              <span className="text-gray-900">{invoice.client?.address || "No address"}</span>
            </div>
            <div className="px-6 py-3 flex border-l border-gray-100">
              <span className="text-gray-500 w-40">Due Date</span>
              <span className="text-gray-900">{formatDate(invoice.dueDate)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2">
            <div className="px-6 py-3 flex">
              <span className="text-gray-500 w-32">Email</span>
              <span className="text-gray-900">{invoice.client?.email || "No email"}</span>
            </div>
            <div className="px-6 py-3 flex border-l border-gray-100">
              <span className="text-gray-500 w-40">Invoice #</span>
              <span className="text-gray-900">{invoice.invoiceNumber}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Table (Editable) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                Description
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-500 w-24">
                Quantity
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 w-32">
                Rate
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 w-32">
                Amount
              </th>
              <th className="px-4 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, index) => (
              <tr key={index}>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    placeholder="Item description"
                    className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-teal-500"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, "quantity", parseInt(e.target.value) || 1)
                    }
                    className="w-full px-2 py-1 border border-gray-200 rounded text-center focus:outline-none focus:border-teal-500"
                  />
                </td>
                <td className="px-4 py-2">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={(item.unit_price_cents / 100).toFixed(2)}
                      onChange={(e) =>
                        updateItem(
                          index,
                          "unit_price_cents",
                          Math.round(parseFloat(e.target.value || "0") * 100)
                        )
                      }
                      className="w-full pl-6 pr-2 py-1 border border-gray-200 rounded text-right focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </td>
                <td className="px-4 py-2 text-right text-gray-900">
                  {formatCurrency(item.total_cents)}
                </td>
                <td className="px-4 py-2">
                  {items.length > 1 && (
                    <button
                      onClick={() => removeItem(index)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Add Item Link */}
        <div className="px-4 py-3 border-t border-gray-100">
          <button
            onClick={addNewItem}
            className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add new item
          </button>
        </div>

        {/* Totals */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex flex-col items-end space-y-1">
            <div className="flex justify-between w-64">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-900">{formatCurrency(subtotalCents)}</span>
            </div>
            <div className="flex justify-between w-64">
              <span className="text-gray-500">Coupon</span>
              <span className="text-gray-900">{formatCurrency(discountCents)}</span>
            </div>
            <div className="flex justify-between w-64">
              <span className="text-gray-500">Tax</span>
              <span className="text-gray-900">{formatCurrency(taxCents)}</span>
            </div>
            <div className="flex justify-between w-64 pt-2 border-t border-gray-300">
              <span className="font-semibold text-gray-900">Invoice Total</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(totalCents)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Note to Client
          </label>
          <p className="text-xs text-gray-500 mb-2">
            This note will be visible on the invoice
          </p>
          <textarea
            value={noteToClient}
            onChange={(e) => setNoteToClient(e.target.value)}
            rows={3}
            placeholder="Add a note for the client..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-teal-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Internal Memo
          </label>
          <p className="text-xs text-gray-500 mb-2">
            This memo is for internal use only and will not be visible on the invoice
          </p>
          <textarea
            value={internalMemo}
            onChange={(e) => setInternalMemo(e.target.value)}
            rows={3}
            placeholder="Add an internal memo..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-teal-500 resize-none"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Link
          href={`/app/office/invoices/${id}`}
          className="px-4 py-2 text-gray-600 hover:text-gray-900"
        >
          CANCEL
        </Link>
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="px-4 py-2 border border-teal-600 text-teal-600 rounded hover:bg-teal-50 disabled:opacity-50"
        >
          {saving ? "SAVING..." : "SAVE DRAFT"}
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving}
          className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
        >
          {saving ? "SAVING..." : "FINALIZE INVOICE"}
        </button>
      </div>
    </div>
  );
}
