"use client";

import { useState, useEffect } from "react";
import {
  Gift,
  Search,
  Plus,
  RefreshCw,
  Mail,
  XCircle,
  DollarSign,
  MoreVertical,
  X,
  Copy,
  Check,
  Calendar,
  User,
  Clock,
} from "lucide-react";

interface GiftCertificate {
  id: string;
  code: string;
  initialValue: number;
  balance: number;
  status: "ACTIVE" | "REDEEMED" | "CANCELED" | "EXPIRED";
  purchaserName: string;
  purchaserEmail: string;
  recipientName: string;
  recipientEmail: string;
  message: string | null;
  expiresAt: string | null;
  deliveredAt: string | null;
  redemptionCount: number;
  createdAt: string;
}

interface Stats {
  total: number;
  active: number;
  redeemed: number;
  totalValue: number;
  totalRedeemed: number;
}

export default function GiftCardsPage() {
  const [loading, setLoading] = useState(true);
  const [certificates, setCertificates] = useState<GiftCertificate[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    redeemed: 0,
    totalValue: 0,
    totalRedeemed: 0,
  });
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCert, setSelectedCert] = useState<GiftCertificate | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [actionMenu, setActionMenu] = useState<string | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    amount: "",
    recipientName: "",
    recipientEmail: "",
    message: "",
    expiresAt: "",
    sendEmail: true,
  });
  const [creating, setCreating] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // Clipboard state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchCertificates();
  }, [statusFilter]);

  async function fetchCertificates() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      if (searchQuery) {
        params.set("search", searchQuery);
      }

      const res = await fetch(`/api/admin/gift-certificates?${params}`);
      const data = await res.json();

      if (res.ok) {
        setCertificates(data.certificates || []);
        setStats(data.stats || {
          total: 0,
          active: 0,
          redeemed: 0,
          totalValue: 0,
          totalRedeemed: 0,
        });
      }
    } catch (error) {
      console.error("Error fetching certificates:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchCertificates();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch("/api/admin/gift-certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(createForm.amount),
          recipientName: createForm.recipientName,
          recipientEmail: createForm.recipientEmail,
          message: createForm.message || undefined,
          expiresAt: createForm.expiresAt || undefined,
          sendEmail: createForm.sendEmail,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setShowCreateModal(false);
        setCreateForm({
          amount: "",
          recipientName: "",
          recipientEmail: "",
          message: "",
          expiresAt: "",
          sendEmail: true,
        });
        fetchCertificates();
      } else {
        alert(data.error || "Failed to create gift certificate");
      }
    } catch (error) {
      console.error("Error creating certificate:", error);
      alert("Failed to create gift certificate");
    } finally {
      setCreating(false);
    }
  }

  async function handleAction(certId: string, action: string, newBalance?: number) {
    try {
      const res = await fetch("/api/admin/gift-certificates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: certId, action, newBalance }),
      });

      const data = await res.json();

      if (res.ok) {
        fetchCertificates();
        setActionMenu(null);
        if (action === "adjust") {
          setShowAdjustModal(false);
          setAdjustAmount("");
        }
        if (action === "resend") {
          alert("Email sent successfully!");
        }
      } else {
        alert(data.error || `Failed to ${action}`);
      }
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
      alert(`Failed to ${action}`);
    }
  }

  async function handleAdjustBalance(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCert) return;

    setAdjusting(true);
    await handleAction(selectedCert.id, "adjust", parseFloat(adjustAmount));
    setAdjusting(false);
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "REDEEMED":
        return "bg-blue-100 text-blue-800";
      case "CANCELED":
        return "bg-red-100 text-red-800";
      case "EXPIRED":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gift Cards</h1>
          <p className="text-gray-600">Manage gift certificates and redemptions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchCertificates}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Plus className="w-4 h-4" />
            Create Gift Card
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-sm text-gray-600">Total Issued</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-sm text-gray-600">Active</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-sm text-gray-600">Fully Redeemed</p>
          <p className="text-2xl font-bold text-blue-600">{stats.redeemed}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-sm text-gray-600">Total Value</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalValue)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-sm text-gray-600">Total Redeemed</p>
          <p className="text-2xl font-bold text-teal-600">{formatCurrency(stats.totalRedeemed)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by code, recipient, or purchaser..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </form>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="REDEEMED">Redeemed</option>
            <option value="CANCELED">Canceled</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : certificates.length === 0 ? (
          <div className="p-12 text-center">
            <Gift className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No gift certificates found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-teal-600 hover:text-teal-700 text-sm font-medium"
            >
              Create your first gift card
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Code</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Recipient</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Initial</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Balance</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Created</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((cert) => (
                  <tr key={cert.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {cert.code}
                        </code>
                        <button
                          onClick={() => copyCode(cert.code)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          {copiedCode === cert.code ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => {
                          setSelectedCert(cert);
                          setShowDetailModal(true);
                        }}
                        className="text-left hover:text-teal-600"
                      >
                        <p className="font-medium text-gray-900">{cert.recipientName}</p>
                        <p className="text-sm text-gray-500">{cert.recipientEmail}</p>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-gray-900">{formatCurrency(cert.initialValue)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={
                          cert.balance < cert.initialValue
                            ? "text-amber-600 font-medium"
                            : "text-gray-900"
                        }
                      >
                        {formatCurrency(cert.balance)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          cert.status
                        )}`}
                      >
                        {cert.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {formatDate(cert.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1 relative">
                        <button
                          onClick={() => setActionMenu(actionMenu === cert.id ? null : cert.id)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {actionMenu === cert.id && (
                          <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-100 z-20">
                            <button
                              onClick={() => {
                                setSelectedCert(cert);
                                setShowDetailModal(true);
                                setActionMenu(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Gift className="w-4 h-4" />
                              View Details
                            </button>
                            {cert.status === "ACTIVE" && (
                              <>
                                <button
                                  onClick={() => handleAction(cert.id, "resend")}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Mail className="w-4 h-4" />
                                  Resend Email
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedCert(cert);
                                    setAdjustAmount(cert.balance.toString());
                                    setShowAdjustModal(true);
                                    setActionMenu(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <DollarSign className="w-4 h-4" />
                                  Adjust Balance
                                </button>
                                <button
                                  onClick={() => {
                                    if (
                                      confirm(
                                        "Are you sure you want to cancel this gift certificate?"
                                      )
                                    ) {
                                      handleAction(cert.id, "cancel");
                                    }
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Create Gift Card</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={createForm.amount}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, amount: e.target.value })
                    }
                    placeholder="50.00"
                    required
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Name
                </label>
                <input
                  type="text"
                  value={createForm.recipientName}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, recipientName: e.target.value })
                  }
                  placeholder="John Smith"
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={createForm.recipientEmail}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, recipientEmail: e.target.value })
                  }
                  placeholder="john@example.com"
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Personal Message (optional)
                </label>
                <textarea
                  value={createForm.message}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, message: e.target.value })
                  }
                  placeholder="Enjoy your gift!"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiration Date (optional)
                </label>
                <input
                  type="date"
                  value={createForm.expiresAt}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, expiresAt: e.target.value })
                  }
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sendEmail"
                  checked={createForm.sendEmail}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, sendEmail: e.target.checked })
                  }
                  className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                />
                <label htmlFor="sendEmail" className="text-sm text-gray-700">
                  Send gift card email to recipient
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Gift Card"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedCert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                  <Gift className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Gift Certificate Details
                  </h2>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">
                      {selectedCert.code}
                    </code>
                    <button
                      onClick={() => copyCode(selectedCert.code)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      {copiedCode === selectedCert.code ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Status and Value */}
              <div className="flex items-center justify-between">
                <span
                  className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(
                    selectedCert.status
                  )}`}
                >
                  {selectedCert.status}
                </span>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(selectedCert.balance)}
                  </p>
                  <p className="text-sm text-gray-500">
                    of {formatCurrency(selectedCert.initialValue)} remaining
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full"
                  style={{
                    width: `${(selectedCert.balance / selectedCert.initialValue) * 100}%`,
                  }}
                />
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Recipient</p>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedCert.recipientName}
                      </p>
                      <p className="text-xs text-gray-500">{selectedCert.recipientEmail}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Purchaser</p>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedCert.purchaserName}
                      </p>
                      <p className="text-xs text-gray-500">{selectedCert.purchaserEmail}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Created</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <p className="text-sm text-gray-900">{formatDate(selectedCert.createdAt)}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    {selectedCert.expiresAt ? "Expires" : "Delivered"}
                  </p>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <p className="text-sm text-gray-900">
                      {selectedCert.expiresAt
                        ? formatDate(selectedCert.expiresAt)
                        : formatDate(selectedCert.deliveredAt)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Message */}
              {selectedCert.message && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Personal Message</p>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg italic">
                    &ldquo;{selectedCert.message}&rdquo;
                  </p>
                </div>
              )}

              {/* Redemption Count */}
              {selectedCert.redemptionCount > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Redemptions</p>
                  <p className="text-sm text-gray-700">
                    Used {selectedCert.redemptionCount} time
                    {selectedCert.redemptionCount !== 1 ? "s" : ""}
                  </p>
                </div>
              )}

              {/* Actions */}
              {selectedCert.status === "ACTIVE" && (
                <div className="flex gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleAction(selectedCert.id, "resend")}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    <Mail className="w-4 h-4" />
                    Resend Email
                  </button>
                  <button
                    onClick={() => {
                      setAdjustAmount(selectedCert.balance.toString());
                      setShowAdjustModal(true);
                      setShowDetailModal(false);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-white bg-teal-600 rounded-lg hover:bg-teal-700"
                  >
                    <DollarSign className="w-4 h-4" />
                    Adjust Balance
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Adjust Balance Modal */}
      {showAdjustModal && selectedCert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Adjust Balance</h2>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdjustBalance} className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Adjusting balance for{" "}
                <span className="font-mono font-medium">{selectedCert.code}</span>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Balance
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    required
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Current balance: {formatCurrency(selectedCert.balance)}
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjusting}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {adjusting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Click outside to close action menu */}
      {actionMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setActionMenu(null)} />
      )}
    </div>
  );
}
