"use client";

import { useState, useEffect } from "react";
import {
  Package,
  Plus,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  X,
  DollarSign,
  Check,
  AlertCircle,
  GripVertical,
} from "lucide-react";

interface AddOn {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  priceType: "FIXED" | "PER_DOG" | "PER_VISIT";
  isRecurring: boolean;
  isActive: boolean;
  sortOrder: number;
  subscriptionCount?: number;
}

export default function AddOnsPage() {
  const [loading, setLoading] = useState(true);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingAddOn, setEditingAddOn] = useState<AddOn | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    description: "",
    priceCents: "",
    priceType: "FIXED" as "FIXED" | "PER_DOG" | "PER_VISIT",
    isRecurring: false,
    isActive: true,
    sortOrder: 0,
  });

  useEffect(() => {
    fetchAddOns();
  }, [showActiveOnly]);

  async function fetchAddOns() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (showActiveOnly) {
        params.set("activeOnly", "true");
      }

      const res = await fetch(`/api/admin/add-ons?${params}`);
      const data = await res.json();

      if (res.ok) {
        setAddOns(data.addOns || []);
      } else {
        setError(data.error || "Failed to load add-ons");
      }
    } catch (err) {
      console.error("Error fetching add-ons:", err);
      setError("Failed to load add-ons");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingAddOn(null);
    setForm({
      name: "",
      description: "",
      priceCents: "",
      priceType: "FIXED",
      isRecurring: false,
      isActive: true,
      sortOrder: addOns.length,
    });
    setShowModal(true);
    setError(null);
  }

  function openEditModal(addOn: AddOn) {
    setEditingAddOn(addOn);
    setForm({
      name: addOn.name,
      description: addOn.description || "",
      priceCents: (addOn.priceCents / 100).toString(),
      priceType: addOn.priceType,
      isRecurring: addOn.isRecurring,
      isActive: addOn.isActive,
      sortOrder: addOn.sortOrder,
    });
    setShowModal(true);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        priceCents: Math.round(parseFloat(form.priceCents) * 100),
        priceType: form.priceType,
        isRecurring: form.isRecurring,
        isActive: form.isActive,
        sortOrder: form.sortOrder,
      };

      const res = await fetch("/api/admin/add-ons", {
        method: editingAddOn ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingAddOn ? { id: editingAddOn.id, ...payload } : payload),
      });

      const data = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchAddOns();
      } else {
        setError(data.error || "Failed to save add-on");
      }
    } catch (err) {
      console.error("Error saving add-on:", err);
      setError("Failed to save add-on");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(addOn: AddOn) {
    if (!confirm(`Are you sure you want to delete "${addOn.name}"?`)) {
      return;
    }

    try {
      const res = await fetch("/api/admin/add-ons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: addOn.id }),
      });

      const data = await res.json();

      if (res.ok) {
        fetchAddOns();
      } else {
        alert(data.error || "Failed to delete add-on");
      }
    } catch (err) {
      console.error("Error deleting add-on:", err);
      alert("Failed to delete add-on");
    }
  }

  async function handleToggleActive(addOn: AddOn) {
    try {
      const res = await fetch("/api/admin/add-ons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: addOn.id, isActive: !addOn.isActive }),
      });

      if (res.ok) {
        fetchAddOns();
      }
    } catch (err) {
      console.error("Error toggling add-on:", err);
    }
  }

  const formatPrice = (cents: number, type: string) => {
    const amount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);

    switch (type) {
      case "PER_DOG":
        return `${amount}/dog`;
      case "PER_VISIT":
        return `${amount}/visit`;
      default:
        return amount;
    }
  };

  const filteredAddOns = addOns.filter(
    (addOn) =>
      addOn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      addOn.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add-Ons</h1>
          <p className="text-gray-600">Manage service add-ons and extras</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAddOns}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Plus className="w-4 h-4" />
            Add New
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
              placeholder="Search add-ons..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div className="flex items-center gap-2">
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
      </div>

      {/* Add-Ons List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : filteredAddOns.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No add-ons found</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-teal-600 hover:text-teal-700 text-sm font-medium"
            >
              Create your first add-on
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredAddOns.map((addOn) => (
              <div
                key={addOn.id}
                className={`flex items-center gap-4 p-4 hover:bg-gray-50 ${
                  !addOn.isActive ? "opacity-60" : ""
                }`}
              >
                <div className="text-gray-300 cursor-move">
                  <GripVertical className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{addOn.name}</h3>
                    {addOn.isRecurring && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        Recurring
                      </span>
                    )}
                    {!addOn.isActive && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  {addOn.description && (
                    <p className="text-sm text-gray-500 truncate">{addOn.description}</p>
                  )}
                  {addOn.subscriptionCount !== undefined && addOn.subscriptionCount > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      Used in {addOn.subscriptionCount} subscription{addOn.subscriptionCount !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {formatPrice(addOn.priceCents, addOn.priceType)}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{addOn.priceType.replace("_", " ")}</p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleActive(addOn)}
                    className={`p-2 rounded-lg ${
                      addOn.isActive
                        ? "text-green-600 hover:bg-green-50"
                        : "text-gray-400 hover:bg-gray-100"
                    }`}
                    title={addOn.isActive ? "Deactivate" : "Activate"}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEditModal(addOn)}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(addOn)}
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
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingAddOn ? "Edit Add-On" : "Create Add-On"}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Deodorizer Treatment"
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe what this add-on includes..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.priceCents}
                      onChange={(e) => setForm({ ...form, priceCents: e.target.value })}
                      placeholder="0.00"
                      required
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price Type</label>
                  <select
                    value={form.priceType}
                    onChange={(e) =>
                      setForm({ ...form, priceType: e.target.value as "FIXED" | "PER_DOG" | "PER_VISIT" })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="FIXED">Fixed</option>
                    <option value="PER_DOG">Per Dog</option>
                    <option value="PER_VISIT">Per Visit</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Recurring</p>
                    <p className="text-sm text-gray-500">Charge this add-on on every visit</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, isRecurring: !form.isRecurring })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      form.isRecurring ? "bg-teal-600" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        form.isRecurring ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Active</p>
                    <p className="text-sm text-gray-500">Available for selection</p>
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
                  {saving ? "Saving..." : editingAddOn ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
