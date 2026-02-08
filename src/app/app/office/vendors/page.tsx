"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Store,
  Plus,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  X,
  Check,
  AlertCircle,
  Phone,
  Mail,
  Globe,
} from "lucide-react";

interface Vendor {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: Record<string, string>;
  payoutMethod: string;
  commissionType: string;
  commissionValue: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function VendorsPage() {
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    contactName: "",
    email: "",
    phone: "",
    website: "",
    payoutMethod: "CHECK" as string,
    commissionType: "PERCENTAGE" as string,
    commissionValue: "",
    notes: "",
    isActive: true,
  });

  useEffect(() => {
    fetchVendors();
  }, [showActiveOnly]);

  async function fetchVendors() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (showActiveOnly) params.set("active", "true");

      const res = await fetch(`/api/admin/vendors?${params}`);
      const data = await res.json();

      if (res.ok) {
        setVendors(data.vendors || []);
      } else {
        setError(data.error || "Failed to load vendors");
      }
    } catch (err) {
      console.error("Error fetching vendors:", err);
      setError("Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingVendor(null);
    setForm({
      name: "",
      contactName: "",
      email: "",
      phone: "",
      website: "",
      payoutMethod: "CHECK",
      commissionType: "PERCENTAGE",
      commissionValue: "",
      notes: "",
      isActive: true,
    });
    setShowModal(true);
    setError(null);
  }

  function openEditModal(vendor: Vendor) {
    setEditingVendor(vendor);
    setForm({
      name: vendor.name,
      contactName: vendor.contactName || "",
      email: vendor.email || "",
      phone: vendor.phone || "",
      website: vendor.website || "",
      payoutMethod: vendor.payoutMethod,
      commissionType: vendor.commissionType,
      commissionValue: vendor.commissionType === "PERCENTAGE"
        ? (vendor.commissionValue / 100).toString()
        : (vendor.commissionValue / 100).toString(),
      notes: vendor.notes || "",
      isActive: vendor.isActive,
    });
    setShowModal(true);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const commissionValue = form.commissionType === "PERCENTAGE"
        ? Math.round(parseFloat(form.commissionValue || "0") * 100)
        : Math.round(parseFloat(form.commissionValue || "0") * 100);

      const payload = {
        name: form.name,
        contactName: form.contactName || null,
        email: form.email || null,
        phone: form.phone || null,
        website: form.website || null,
        payoutMethod: form.payoutMethod,
        commissionType: form.commissionType,
        commissionValue,
        notes: form.notes || null,
        isActive: form.isActive,
      };

      const res = await fetch("/api/admin/vendors", {
        method: editingVendor ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingVendor ? { id: editingVendor.id, ...payload } : payload),
      });

      const data = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchVendors();
      } else {
        setError(data.error || "Failed to save vendor");
      }
    } catch (err) {
      console.error("Error saving vendor:", err);
      setError("Failed to save vendor");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(vendor: Vendor) {
    if (!confirm(`Are you sure you want to deactivate "${vendor.name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/vendors?id=${vendor.id}`, { method: "DELETE" });
      const data = await res.json();

      if (res.ok) {
        fetchVendors();
      } else {
        alert(data.error || "Failed to deactivate vendor");
      }
    } catch (err) {
      console.error("Error deactivating vendor:", err);
      alert("Failed to deactivate vendor");
    }
  }

  async function handleToggleActive(vendor: Vendor) {
    try {
      const res = await fetch("/api/admin/vendors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: vendor.id, isActive: !vendor.isActive }),
      });

      if (res.ok) fetchVendors();
    } catch (err) {
      console.error("Error toggling vendor:", err);
    }
  }

  const formatCommission = (type: string, value: number) => {
    if (type === "PERCENTAGE") return `${(value / 100).toFixed(1)}%`;
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100);
  };

  const filteredVendors = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
          <p className="text-gray-600">Manage 3rd party service vendors</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/office/vendors/payouts"
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
          >
            Payouts
          </Link>
          <button
            onClick={fetchVendors}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Plus className="w-4 h-4" />
            Add Vendor
          </button>
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
              placeholder="Search vendors..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showActiveOnly}
              onChange={(e) => setShowActiveOnly(e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
            />
            Show active only
          </label>
        </div>
      </div>

      {/* Vendors List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="p-12 text-center">
            <Store className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No vendors found</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-teal-600 hover:text-teal-700 text-sm font-medium"
            >
              Add your first vendor
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredVendors.map((vendor) => (
              <div
                key={vendor.id}
                className={`flex items-center gap-4 p-4 hover:bg-gray-50 ${
                  !vendor.isActive ? "opacity-60" : ""
                }`}
              >
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Store className="w-5 h-5 text-teal-600" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/app/office/vendors/${vendor.id}`}
                      className="font-medium text-gray-900 hover:text-teal-600"
                    >
                      {vendor.name}
                    </Link>
                    {!vendor.isActive && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  {vendor.contactName && (
                    <p className="text-sm text-gray-500">{vendor.contactName}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {vendor.phone && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Phone className="w-3 h-3" />
                        {vendor.phone}
                      </span>
                    )}
                    {vendor.email && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Mail className="w-3 h-3" />
                        {vendor.email}
                      </span>
                    )}
                    {vendor.website && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Globe className="w-3 h-3" />
                        {vendor.website}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium text-gray-900">
                    {formatCommission(vendor.commissionType, vendor.commissionValue)}
                  </p>
                  <p className="text-xs text-gray-500">{vendor.payoutMethod}</p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggleActive(vendor)}
                    className={`p-2 rounded-lg ${
                      vendor.isActive
                        ? "text-green-600 hover:bg-green-50"
                        : "text-gray-400 hover:bg-gray-100"
                    }`}
                    title={vendor.isActive ? "Deactivate" : "Activate"}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEditModal(vendor)}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(vendor)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-xl">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingVendor ? "Edit Vendor" : "Add Vendor"}
              </h2>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Green Lawn Care"
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                <input
                  type="text"
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  placeholder="Primary contact person"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="vendor@example.com"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(555) 555-5555"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payout Method</label>
                  <select
                    value={form.payoutMethod}
                    onChange={(e) => setForm({ ...form, payoutMethod: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="CHECK">Check</option>
                    <option value="ACH">ACH</option>
                    <option value="VENMO">Venmo</option>
                    <option value="PAYPAL">PayPal</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Commission Type</label>
                  <select
                    value={form.commissionType}
                    onChange={(e) => setForm({ ...form, commissionType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED_AMOUNT">Fixed Amount</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Commission Value {form.commissionType === "PERCENTAGE" ? "(%)" : "($)"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.commissionValue}
                  onChange={(e) => setForm({ ...form, commissionValue: e.target.value })}
                  placeholder={form.commissionType === "PERCENTAGE" ? "e.g., 10.0" : "e.g., 25.00"}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Internal notes about this vendor..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Active</p>
                  <p className="text-sm text-gray-500">Available for assignments</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isActive: !form.isActive })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    form.isActive ? "bg-teal-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      form.isActive ? "translate-x-5" : ""
                    }`}
                  />
                </button>
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
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingVendor ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
