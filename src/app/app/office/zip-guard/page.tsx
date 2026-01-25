"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  Plus,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  X,
  MapPin,
  AlertCircle,
  Check,
} from "lucide-react";

interface ZipRestriction {
  id: string;
  zip: string;
  blocked_frequencies: string[];
  blocked_plan_ids: string[];
  created_at: string;
  updated_at: string;
}

const FREQUENCIES = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Bi-Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "ONETIME", label: "One-Time" },
];

export default function ZipGuardPage() {
  const [loading, setLoading] = useState(true);
  const [restrictions, setRestrictions] = useState<ZipRestriction[]>([]);
  const [serviceZips, setServiceZips] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingRestriction, setEditingRestriction] = useState<ZipRestriction | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    zip: "",
    blockedFrequencies: [] as string[],
  });

  useEffect(() => {
    fetchRestrictions();
  }, []);

  async function fetchRestrictions() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/zip-guard");
      const data = await res.json();

      if (res.ok) {
        setRestrictions(data.restrictions || []);
        setServiceZips(data.serviceZips || []);
      } else {
        setError(data.error || "Failed to load restrictions");
      }
    } catch (err) {
      console.error("Error fetching restrictions:", err);
      setError("Failed to load restrictions");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingRestriction(null);
    setForm({
      zip: "",
      blockedFrequencies: [],
    });
    setShowModal(true);
    setError(null);
  }

  function openEditModal(restriction: ZipRestriction) {
    setEditingRestriction(restriction);
    setForm({
      zip: restriction.zip,
      blockedFrequencies: restriction.blocked_frequencies || [],
    });
    setShowModal(true);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/zip-guard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zip: form.zip,
          blockedFrequencies: form.blockedFrequencies,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchRestrictions();
      } else {
        setError(data.error || "Failed to save restriction");
      }
    } catch (err) {
      console.error("Error saving restriction:", err);
      setError("Failed to save restriction");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(restriction: ZipRestriction) {
    if (!confirm(`Remove all restrictions for ZIP ${restriction.zip}?`)) {
      return;
    }

    try {
      const res = await fetch("/api/admin/zip-guard", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: restriction.id }),
      });

      const data = await res.json();

      if (res.ok) {
        fetchRestrictions();
      } else {
        alert(data.error || "Failed to delete restriction");
      }
    } catch (err) {
      console.error("Error deleting restriction:", err);
      alert("Failed to delete restriction");
    }
  }

  function toggleFrequency(freq: string) {
    setForm((prev) => ({
      ...prev,
      blockedFrequencies: prev.blockedFrequencies.includes(freq)
        ? prev.blockedFrequencies.filter((f) => f !== freq)
        : [...prev.blockedFrequencies, freq],
    }));
  }

  const filteredRestrictions = restrictions.filter((r) => r.zip.includes(searchQuery));

  // ZIPs with restrictions
  const restrictedZips = new Set(restrictions.map((r) => r.zip));

  // Available ZIPs (service zips without restrictions)
  const availableZips = serviceZips.filter((z) => !restrictedZips.has(z) || editingRestriction?.zip === z);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zip Guard</h1>
          <p className="text-gray-600">Manage service frequency restrictions by ZIP code</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRestrictions}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Plus className="w-4 h-4" />
            Add Restriction
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">How Zip Guard Works</p>
            <p className="text-sm text-blue-700 mt-1">
              Block specific service frequencies for certain ZIP codes. For example, you might
              only offer weekly service in distant areas, or block one-time cleanups in certain zones.
              Customers in blocked ZIPs will not see those frequency options during signup.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ZIP code..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
      </div>

      {/* Restrictions List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : filteredRestrictions.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No ZIP restrictions configured</p>
            <p className="text-sm text-gray-400 mt-1">
              All frequencies are available in all service areas
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-teal-600 hover:text-teal-700 text-sm font-medium"
            >
              Add your first restriction
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredRestrictions.map((restriction) => (
              <div
                key={restriction.id}
                className="flex items-center gap-4 p-4 hover:bg-gray-50"
              >
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-amber-600" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 font-mono">{restriction.zip}</h3>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {restriction.blocked_frequencies.length === 0 ? (
                      <span className="text-sm text-gray-500">No frequencies blocked</span>
                    ) : (
                      restriction.blocked_frequencies.map((freq) => (
                        <span
                          key={freq}
                          className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full"
                        >
                          {FREQUENCIES.find((f) => f.value === freq)?.label || freq} blocked
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(restriction)}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(restriction)}
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

      {/* Stats Summary */}
      {restrictions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600">ZIPs with Restrictions</p>
            <p className="text-2xl font-bold text-gray-900">{restrictions.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600">Weekly Blocked</p>
            <p className="text-2xl font-bold text-red-600">
              {restrictions.filter((r) => r.blocked_frequencies.includes("WEEKLY")).length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600">Bi-Weekly Blocked</p>
            <p className="text-2xl font-bold text-red-600">
              {restrictions.filter((r) => r.blocked_frequencies.includes("BIWEEKLY")).length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600">One-Time Blocked</p>
            <p className="text-2xl font-bold text-red-600">
              {restrictions.filter((r) => r.blocked_frequencies.includes("ONETIME")).length}
            </p>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingRestriction ? "Edit Restriction" : "Add Restriction"}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                {editingRestriction ? (
                  <div className="px-3 py-2 bg-gray-100 rounded-lg font-mono">
                    {form.zip}
                  </div>
                ) : availableZips.length > 0 ? (
                  <select
                    value={form.zip}
                    onChange={(e) => setForm({ ...form, zip: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="">Select a ZIP code</option>
                    {availableZips.map((zip) => (
                      <option key={zip} value={zip}>
                        {zip}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.zip}
                    onChange={(e) => setForm({ ...form, zip: e.target.value })}
                    placeholder="Enter 5-digit ZIP"
                    pattern="\d{5}"
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Block These Frequencies
                </label>
                <div className="space-y-2">
                  {FREQUENCIES.map((freq) => (
                    <button
                      key={freq.value}
                      type="button"
                      onClick={() => toggleFrequency(freq.value)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        form.blockedFrequencies.includes(freq.value)
                          ? "border-red-300 bg-red-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <span
                        className={
                          form.blockedFrequencies.includes(freq.value)
                            ? "font-medium text-red-700"
                            : "text-gray-700"
                        }
                      >
                        {freq.label}
                      </span>
                      {form.blockedFrequencies.includes(freq.value) ? (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                          BLOCKED
                        </span>
                      ) : (
                        <Check className="w-4 h-4 text-green-500" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Checked frequencies will NOT be available for customers in this ZIP
                </p>
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
                  disabled={saving || !form.zip}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
