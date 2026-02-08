"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  X,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

interface VendorPayout {
  id: string;
  vendorId: string;
  vendorName: string | null;
  amountCents: number;
  status: string;
  payoutMethod: string | null;
  referenceNumber: string | null;
  periodStart: string;
  periodEnd: string;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface VendorOption {
  id: string;
  name: string;
}

export default function VendorPayoutsPage() {
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<VendorPayout[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<VendorOption[]>([]);

  const [form, setForm] = useState({
    vendorId: "",
    amountCents: "",
    payoutMethod: "",
    periodStart: "",
    periodEnd: "",
    notes: "",
  });

  useEffect(() => {
    fetchPayouts();
  }, [statusFilter]);

  async function fetchPayouts() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);

      // Check for vendorId in URL
      const urlParams = new URLSearchParams(window.location.search);
      const vendorId = urlParams.get("vendorId");
      if (vendorId) params.set("vendorId", vendorId);

      const res = await fetch(`/api/admin/vendor-payouts?${params}`);
      const data = await res.json();

      if (res.ok) {
        setPayouts(data.payouts || []);
      } else {
        setError(data.error || "Failed to load payouts");
      }
    } catch (err) {
      console.error("Error fetching payouts:", err);
      setError("Failed to load payouts");
    } finally {
      setLoading(false);
    }
  }

  async function fetchVendors() {
    try {
      const res = await fetch("/api/admin/vendors?active=true");
      const data = await res.json();
      if (res.ok) {
        setVendors((data.vendors || []).map((v: { id: string; name: string }) => ({ id: v.id, name: v.name })));
      }
    } catch (err) {
      console.error("Error fetching vendors:", err);
    }
  }

  function openCreateModal() {
    setForm({ vendorId: "", amountCents: "", payoutMethod: "", periodStart: "", periodEnd: "", notes: "" });
    setShowModal(true);
    setError(null);
    fetchVendors();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/vendor-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: form.vendorId,
          amountCents: Math.round(parseFloat(form.amountCents) * 100),
          payoutMethod: form.payoutMethod || null,
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          notes: form.notes || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowModal(false);
        fetchPayouts();
      } else {
        setError(data.error || "Failed to create payout");
      }
    } catch (err) {
      console.error("Error creating payout:", err);
      setError("Failed to create payout");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPaid(payout: VendorPayout) {
    if (!confirm(`Mark this ${formatCurrency(payout.amountCents)} payout to ${payout.vendorName} as paid?`)) return;

    try {
      const res = await fetch("/api/admin/vendor-payouts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: payout.id, status: "PAID" }),
      });

      if (res.ok) fetchPayouts();
    } catch (err) {
      console.error("Error marking payout as paid:", err);
    }
  }

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

  const filteredPayouts = payouts.filter(
    (p) =>
      p.vendorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.referenceNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPending = payouts.filter((p) => p.status === "PENDING").reduce((sum, p) => sum + p.amountCents, 0);
  const totalPaid = payouts.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <Link href="/app/office/vendors" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Vendors
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor Payouts</h1>
          <p className="text-gray-600">Track payments to 3rd party vendors</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchPayouts} className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Plus className="w-4 h-4" /> New Payout
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Pending Payouts</p>
          <p className="text-2xl font-bold text-yellow-600">{formatCurrency(totalPending)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Total Paid</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by vendor or reference..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="CANCELED">Canceled</option>
          </select>
        </div>
      </div>

      {/* Payouts List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : filteredPayouts.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No payouts found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredPayouts.map((payout) => (
              <div key={payout.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/app/office/vendors/payouts/${payout.id}`}
                      className="font-medium text-gray-900 hover:text-teal-600"
                    >
                      {payout.vendorName || "Unknown Vendor"}
                    </Link>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      payout.status === "PAID" ? "bg-green-100 text-green-700" :
                      payout.status === "CANCELED" ? "bg-red-100 text-red-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {payout.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {new Date(payout.periodStart).toLocaleDateString()} - {new Date(payout.periodEnd).toLocaleDateString()}
                    {payout.referenceNumber && ` | Ref: ${payout.referenceNumber}`}
                  </p>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="font-semibold text-gray-900">{formatCurrency(payout.amountCents)}</p>
                  {payout.payoutMethod && (
                    <p className="text-xs text-gray-500">{payout.payoutMethod}</p>
                  )}
                </div>

                {payout.status === "PENDING" && (
                  <button
                    onClick={() => handleMarkPaid(payout)}
                    className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 flex-shrink-0"
                  >
                    Mark Paid
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Payout Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Create Payout</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor *</label>
                <select
                  value={form.vendorId}
                  onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select vendor...</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amountCents}
                  onChange={(e) => setForm({ ...form, amountCents: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payout Method</label>
                <select
                  value={form.payoutMethod}
                  onChange={(e) => setForm({ ...form, payoutMethod: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select method...</option>
                  <option value="CHECK">Check</option>
                  <option value="ACH">ACH</option>
                  <option value="VENMO">Venmo</option>
                  <option value="PAYPAL">PayPal</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period Start *</label>
                  <input
                    type="date"
                    value={form.periodStart}
                    onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period End *</label>
                  <input
                    type="date"
                    value={form.periodEnd}
                    onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                  {saving ? "Creating..." : "Create Payout"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
