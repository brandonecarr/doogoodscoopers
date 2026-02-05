"use client";

import { useState, useEffect } from "react";
import {
  Tag,
  Search,
  RefreshCw,
  Plus,
  X,
  Trash2,
  Star,
  StarOff,
  Percent,
  DollarSign,
  Gift,
  Calendar,
  Eye,
} from "lucide-react";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_VISITS";
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  min_purchase_cents: number | null;
  applies_to: "ALL" | "FIRST_VISIT" | "RECURRING";
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

export default function CouponsPage() {
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  // New coupon form state
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    description: "",
    discount_type: "PERCENTAGE" as "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_VISITS",
    discount_value: "",
    hasDateLimit: false,
    valid_from: "",
    valid_until: "",
    hasMaxUses: false,
    max_uses: "",
    applies_to: "ALL" as "ALL" | "FIRST_VISIT" | "RECURRING",
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  async function fetchCoupons() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coupons");
      const data = await res.json();
      if (res.ok) {
        setCoupons(data.coupons || []);
      }
    } catch (error) {
      console.error("Error fetching coupons:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchCoupons();
  }

  async function handleCreateCoupon(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        code: newCoupon.code,
        description: newCoupon.description || null,
        discount_type: newCoupon.discount_type,
        discount_value:
          newCoupon.discount_type === "FIXED_AMOUNT"
            ? Math.round(parseFloat(newCoupon.discount_value) * 100)
            : parseInt(newCoupon.discount_value),
        valid_from: newCoupon.hasDateLimit && newCoupon.valid_from ? newCoupon.valid_from : null,
        valid_until: newCoupon.hasDateLimit && newCoupon.valid_until ? newCoupon.valid_until : null,
        max_uses: newCoupon.hasMaxUses && newCoupon.max_uses ? parseInt(newCoupon.max_uses) : null,
        applies_to: newCoupon.applies_to,
      };

      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setShowNewModal(false);
        resetNewCouponForm();
        fetchCoupons();
      } else {
        alert(data.error || "Failed to create coupon");
      }
    } catch (error) {
      console.error("Error creating coupon:", error);
      alert("Failed to create coupon");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(couponId: string, isCurrentlyDefault: boolean) {
    setSettingDefaultId(couponId);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: couponId,
          action: isCurrentlyDefault ? "unsetDefault" : "setDefault",
        }),
      });

      if (res.ok) {
        fetchCoupons();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update default coupon");
      }
    } catch (error) {
      console.error("Error setting default:", error);
      alert("Failed to update default coupon");
    } finally {
      setSettingDefaultId(null);
    }
  }

  async function handleDelete(couponId: string) {
    if (!confirm("Are you sure you want to delete this coupon? This action cannot be undone.")) {
      return;
    }

    setDeletingId(couponId);
    try {
      const res = await fetch(`/api/admin/coupons?id=${couponId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchCoupons();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete coupon");
      }
    } catch (error) {
      console.error("Error deleting coupon:", error);
      alert("Failed to delete coupon");
    } finally {
      setDeletingId(null);
    }
  }

  function resetNewCouponForm() {
    setNewCoupon({
      code: "",
      description: "",
      discount_type: "PERCENTAGE",
      discount_value: "",
      hasDateLimit: false,
      valid_from: "",
      valid_until: "",
      hasMaxUses: false,
      max_uses: "",
      applies_to: "ALL",
    });
  }

  function formatDiscountTerms(coupon: Coupon): string {
    switch (coupon.discount_type) {
      case "PERCENTAGE":
        return `${coupon.discount_value}% off`;
      case "FIXED_AMOUNT":
        return `$${(coupon.discount_value / 100).toFixed(2)} off`;
      case "FREE_VISITS":
        return `${coupon.discount_value} free visit${coupon.discount_value !== 1 ? "s" : ""}`;
      default:
        return "";
    }
  }

  function formatDate(date: string | null) {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getDiscountIcon(type: string) {
    switch (type) {
      case "PERCENTAGE":
        return <Percent className="w-4 h-4" />;
      case "FIXED_AMOUNT":
        return <DollarSign className="w-4 h-4" />;
      case "FREE_VISITS":
        return <Gift className="w-4 h-4" />;
      default:
        return <Tag className="w-4 h-4" />;
    }
  }

  // Filter coupons based on search
  const filteredCoupons = coupons.filter((coupon) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      coupon.code.toLowerCase().includes(query) ||
      (coupon.description && coupon.description.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coupons</h1>
          <p className="text-gray-600">Manage discount coupons and promotions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchCoupons}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code or name..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="p-12 text-center">
            <Tag className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No coupons found</p>
            <p className="text-sm text-gray-400 mt-1">
              Create your first coupon to offer discounts
            </p>
            <button
              onClick={() => setShowNewModal(true)}
              className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Create Coupon
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Coupon Name
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Coupon Code
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Terms</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Redemptions
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Expires</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCoupons.map((coupon) => (
                  <tr
                    key={coupon.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 ${
                      !coupon.is_active ? "opacity-50" : ""
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {coupon.description || coupon.code}
                        </span>
                        {coupon.is_default && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            Default
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {coupon.code}
                      </code>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 text-gray-700">
                        {getDiscountIcon(coupon.discount_type)}
                        <span>{formatDiscountTerms(coupon)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {coupon.current_uses}
                      {coupon.max_uses && (
                        <span className="text-gray-400"> / {coupon.max_uses}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {formatDate(coupon.valid_until)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setSelectedCoupon(coupon);
                            setShowViewModal(true);
                          }}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSetDefault(coupon.id, coupon.is_default)}
                          disabled={settingDefaultId === coupon.id}
                          className={`p-2 rounded ${
                            coupon.is_default
                              ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                          }`}
                          title={coupon.is_default ? "Unset Default" : "Set Default"}
                        >
                          {settingDefaultId === coupon.id ? (
                            <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                          ) : coupon.is_default ? (
                            <StarOff className="w-4 h-4" />
                          ) : (
                            <Star className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(coupon.id)}
                          disabled={deletingId === coupon.id}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          {deletingId === coupon.id ? (
                            <div className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Coupon Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">New Coupon</h2>
              <button
                onClick={() => {
                  setShowNewModal(false);
                  resetNewCouponForm();
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCoupon} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coupon Name</label>
                <input
                  type="text"
                  value={newCoupon.description}
                  onChange={(e) => setNewCoupon({ ...newCoupon, description: e.target.value })}
                  placeholder="e.g., Summer Sale 2024"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Coupon Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCoupon.code}
                  onChange={(e) =>
                    setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g., SUMMER20"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Coupon Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={newCoupon.discount_type}
                  onChange={(e) =>
                    setNewCoupon({
                      ...newCoupon,
                      discount_type: e.target.value as "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_VISITS",
                      discount_value: "",
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="PERCENTAGE">Percent</option>
                  <option value="FIXED_AMOUNT">Fixed Amount</option>
                  <option value="FREE_VISITS">Free Visits</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Value <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  {newCoupon.discount_type === "FIXED_AMOUNT" && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  )}
                  <input
                    type="number"
                    required
                    min="0"
                    max={newCoupon.discount_type === "PERCENTAGE" ? "100" : undefined}
                    step={newCoupon.discount_type === "FIXED_AMOUNT" ? "0.01" : "1"}
                    value={newCoupon.discount_value}
                    onChange={(e) => setNewCoupon({ ...newCoupon, discount_value: e.target.value })}
                    placeholder={
                      newCoupon.discount_type === "PERCENTAGE"
                        ? "e.g., 20"
                        : newCoupon.discount_type === "FREE_VISITS"
                        ? "e.g., 1"
                        : "e.g., 10.00"
                    }
                    className={`w-full pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${
                      newCoupon.discount_type === "FIXED_AMOUNT" ? "pl-8" : "pl-3"
                    }`}
                  />
                  {newCoupon.discount_type === "PERCENTAGE" && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                  )}
                  {newCoupon.discount_type === "FREE_VISITS" && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                      visits
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Applies To</label>
                <select
                  value={newCoupon.applies_to}
                  onChange={(e) =>
                    setNewCoupon({
                      ...newCoupon,
                      applies_to: e.target.value as "ALL" | "FIRST_VISIT" | "RECURRING",
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="ALL">All Services</option>
                  <option value="FIRST_VISIT">First Visit Only</option>
                  <option value="RECURRING">Recurring Only</option>
                </select>
              </div>

              {/* Date Limit */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCoupon.hasDateLimit}
                    onChange={(e) =>
                      setNewCoupon({ ...newCoupon, hasDateLimit: e.target.checked })
                    }
                    className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                  />
                  <span className="text-sm text-gray-700">Limit to date range</span>
                </label>
                {newCoupon.hasDateLimit && (
                  <div className="grid grid-cols-2 gap-3 pl-7">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={newCoupon.valid_from}
                        onChange={(e) => setNewCoupon({ ...newCoupon, valid_from: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">End Date</label>
                      <input
                        type="date"
                        value={newCoupon.valid_until}
                        onChange={(e) =>
                          setNewCoupon({ ...newCoupon, valid_until: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Max Uses */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCoupon.hasMaxUses}
                    onChange={(e) => setNewCoupon({ ...newCoupon, hasMaxUses: e.target.checked })}
                    className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                  />
                  <span className="text-sm text-gray-700">Limit total redemptions</span>
                </label>
                {newCoupon.hasMaxUses && (
                  <div className="pl-7">
                    <input
                      type="number"
                      min="1"
                      value={newCoupon.max_uses}
                      onChange={(e) => setNewCoupon({ ...newCoupon, max_uses: e.target.value })}
                      placeholder="Maximum number of uses"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewModal(false);
                    resetNewCouponForm();
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? "Creating..." : "Create Coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Coupon Modal */}
      {showViewModal && selectedCoupon && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                  <Tag className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Coupon Details</h2>
                  {selectedCoupon.is_default && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                      Default Coupon
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Code</p>
                  <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                    {selectedCoupon.code}
                  </code>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                  <span
                    className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                      selectedCoupon.is_active
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {selectedCoupon.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              {selectedCoupon.description && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Name</p>
                  <p className="text-gray-900">{selectedCoupon.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Discount</p>
                  <div className="flex items-center gap-2 text-gray-900">
                    {getDiscountIcon(selectedCoupon.discount_type)}
                    <span>{formatDiscountTerms(selectedCoupon)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Applies To</p>
                  <p className="text-gray-900">
                    {selectedCoupon.applies_to === "ALL"
                      ? "All Services"
                      : selectedCoupon.applies_to === "FIRST_VISIT"
                      ? "First Visit"
                      : "Recurring"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Redemptions</p>
                  <p className="text-gray-900">
                    {selectedCoupon.current_uses}
                    {selectedCoupon.max_uses && ` / ${selectedCoupon.max_uses}`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Expires</p>
                  <p className="text-gray-900">{formatDate(selectedCoupon.valid_until)}</p>
                </div>
              </div>

              {(selectedCoupon.valid_from || selectedCoupon.valid_until) && (
                <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Valid{" "}
                    {selectedCoupon.valid_from && `from ${formatDate(selectedCoupon.valid_from)}`}
                    {selectedCoupon.valid_from && selectedCoupon.valid_until && " "}
                    {selectedCoupon.valid_until && `until ${formatDate(selectedCoupon.valid_until)}`}
                  </span>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    handleSetDefault(selectedCoupon.id, selectedCoupon.is_default);
                    setShowViewModal(false);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg ${
                    selectedCoupon.is_default
                      ? "text-amber-700 bg-amber-100 hover:bg-amber-200"
                      : "text-gray-700 bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  {selectedCoupon.is_default ? (
                    <>
                      <StarOff className="w-4 h-4" />
                      Unset Default
                    </>
                  ) : (
                    <>
                      <Star className="w-4 h-4" />
                      Set Default
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    handleDelete(selectedCoupon.id);
                    setShowViewModal(false);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
