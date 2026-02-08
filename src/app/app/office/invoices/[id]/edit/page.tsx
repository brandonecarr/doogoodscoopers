"use client";

import { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, ChevronDown } from "lucide-react";

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

interface ServiceOption {
  label: string;
  description: string;
  unitPriceCents: number;
  quantity: number;
  category: string;
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

  // Service options for auto-populate
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([]);
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
  const dropdownRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (openDropdownIndex !== null) {
        const ref = dropdownRefs.current[openDropdownIndex];
        if (ref && !ref.contains(e.target as Node)) {
          setOpenDropdownIndex(null);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDropdownIndex]);

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

        // Fetch client services for auto-populate
        if (data.invoice.client?.id) {
          fetchClientServices(data.invoice.client.id);
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

  // Round to nearest 50 cents: 0-24¢ → .00, 25-74¢ → .50, 75-99¢ → next dollar
  function roundToNearest50Cents(cents: number): number {
    const remainder = cents % 100;
    const base = Math.floor(cents / 100) * 100;
    if (remainder < 25) return base;
    if (remainder < 75) return base + 50;
    return base + 100;
  }

  // Convert per-visit price to monthly rate
  function toMonthlyCents(perVisitCents: number, frequency: string): number {
    const multipliers: Record<string, number> = {
      SEVEN_TIMES_A_WEEK: 365,
      SIX_TIMES_A_WEEK: 312,
      FIVE_TIMES_A_WEEK: 260,
      FOUR_TIMES_A_WEEK: 208,
      THREE_TIMES_A_WEEK: 156,
      TWO_TIMES_A_WEEK: 104,
      TWICE_WEEKLY: 104,
      ONCE_A_WEEK: 52,
      WEEKLY: 52,
      BI_WEEKLY: 26,
      BIWEEKLY: 26,
      EVERY_THREE_WEEKS: 17,
      EVERY_FOUR_WEEKS: 13,
      TWICE_PER_MONTH: 24,
      ONCE_A_MONTH: 12,
      MONTHLY: 12,
      ONE_TIME: 1,
      ONETIME: 1,
    };
    const mult = multipliers[frequency] || 12;
    const annualCents = perVisitCents * mult;
    return roundToNearest50Cents(Math.round(annualCents / 12));
  }

  async function fetchClientServices(clientId: string) {
    const options: ServiceOption[] = [];

    try {
      // Fetch client data (subscriptions) and cross-sells in parallel
      const [clientRes, crossSellsRes] = await Promise.all([
        fetch(`/api/admin/clients/${clientId}`),
        fetch(`/api/admin/clients/${clientId}/cross-sells`),
      ]);

      if (clientRes.ok) {
        const clientData = await clientRes.json();
        const client = clientData.client;
        const subscriptions = client?.subscriptions || [];
        const activeDogs = (client?.dogs || []).filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (d: any) => d.isActive
        ).length;
        const dogLabel = activeDogs === 1 ? "1 Dog" : `${activeDogs} Dogs`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        subscriptions.forEach((sub: any) => {
          if (sub.status === "ACTIVE") {
            const freq = sub.frequency || "MONTHLY";
            const perVisitCents = sub.pricePerVisitCents || 0;
            const monthlyCents = toMonthlyCents(perVisitCents, freq);
            const label = `${freq} - ${dogLabel} (${formatCurrency(perVisitCents)}/visit)`;

            options.push({
              label,
              description: `${label} → ${formatCurrency(monthlyCents)}/mo`,
              unitPriceCents: monthlyCents,
              quantity: 1,
              category: "Subscriptions",
            });
          }
        });
      }

      if (crossSellsRes.ok) {
        const crossSellData = await crossSellsRes.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (crossSellData.crossSells || []).forEach((cs: any) => {
          options.push({
            label: cs.name,
            description: `${cs.name}${cs.unit ? ` (${cs.unit})` : ""} - ${formatCurrency(cs.pricePerUnitCents)}`,
            unitPriceCents: cs.pricePerUnitCents,
            quantity: cs.quantity || 1,
            category: "Cross-Sells",
          });
        });
      }
    } catch (err) {
      console.error("Error fetching client services:", err);
    }

    setServiceOptions(options);
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

  function selectService(index: number, option: ServiceOption) {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      description: option.label,
      quantity: option.quantity,
      unit_price_cents: option.unitPriceCents,
      total_cents: option.quantity * option.unitPriceCents,
    };
    setItems(updated);
    setOpenDropdownIndex(null);
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

  // Group service options by category
  const groupedOptions: Record<string, ServiceOption[]> = {};
  serviceOptions.forEach((opt) => {
    if (!groupedOptions[opt.category]) groupedOptions[opt.category] = [];
    groupedOptions[opt.category].push(opt);
  });

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
                  <div
                    className="relative"
                    ref={(el) => { dropdownRefs.current[index] = el; }}
                  >
                    <div className="relative">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                        onFocus={() => {
                          if (serviceOptions.length > 0) setOpenDropdownIndex(index);
                        }}
                        placeholder="Item description"
                        className="w-full px-2 py-1 pr-7 border border-gray-200 rounded focus:outline-none focus:border-teal-500"
                      />
                      {serviceOptions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setOpenDropdownIndex(openDropdownIndex === index ? null : index)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
                          tabIndex={-1}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {openDropdownIndex === index && serviceOptions.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {Object.entries(groupedOptions).map(([category, options]) => (
                          <div key={category}>
                            <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase bg-gray-50 sticky top-0">
                              {category}
                            </div>
                            {options.map((option, optIdx) => (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() => selectService(index, option)}
                                className="w-full px-3 py-2 text-left hover:bg-teal-50 flex items-center justify-between gap-2"
                              >
                                <span className="text-sm text-gray-900 truncate">{option.label}</span>
                                <span className="text-xs text-gray-500 flex-shrink-0">
                                  {formatCurrency(option.unitPriceCents)}
                                </span>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
