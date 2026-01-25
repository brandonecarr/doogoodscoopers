"use client";

import { useState, useEffect } from "react";
import {
  Share2,
  Search,
  RefreshCw,
  Gift,
  Settings,
  X,
  User,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Check,
  ChevronRight,
  Copy,
  AlertCircle,
  TrendingUp,
} from "lucide-react";

interface ReferralSettings {
  isEnabled: boolean;
  rewardReferrerCents: number;
  rewardRefereeCents: number;
  rewardType: string;
  terms: string | null;
}

interface Referral {
  id: string;
  referrerClientId: string | null;
  referrerName: string;
  referrerEmail: string | null;
  refereeName: string;
  refereeEmail: string;
  refereePhone: string | null;
  referralCode: string;
  status: "NEW" | "INVITED" | "SIGNED_UP" | "CONVERTED" | "REWARDED" | "CLOSED";
  convertedClientId: string | null;
  convertedAt: string | null;
  rewards: {
    referrer: number;
    referee: number;
  };
  createdAt: string;
}

interface Stats {
  total: number;
  converted: number;
  pending: number;
  totalRewardsIssued: number;
}

export default function ReferralsPage() {
  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [settings, setSettings] = useState<ReferralSettings | null>(null);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    converted: 0,
    pending: 0,
    totalRewardsIssued: 0,
  });
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    isEnabled: true,
    rewardReferrer: "25",
    rewardReferee: "10",
    rewardType: "ACCOUNT_CREDIT",
    terms: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Clipboard state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchReferrals();
  }, [statusFilter]);

  async function fetchReferrals() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      if (searchQuery) {
        params.set("search", searchQuery);
      }

      const res = await fetch(`/api/admin/referrals?${params}`);
      const data = await res.json();

      if (res.ok) {
        setReferrals(data.referrals || []);
        setSettings(data.settings || null);
        setStats(data.stats || {
          total: 0,
          converted: 0,
          pending: 0,
          totalRewardsIssued: 0,
        });

        // Update settings form if we have settings
        if (data.settings) {
          setSettingsForm({
            isEnabled: data.settings.isEnabled,
            rewardReferrer: (data.settings.rewardReferrerCents / 100).toString(),
            rewardReferee: (data.settings.rewardRefereeCents / 100).toString(),
            rewardType: data.settings.rewardType,
            terms: data.settings.terms || "",
          });
        }
      }
    } catch (error) {
      console.error("Error fetching referrals:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchReferrals();
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);

    try {
      const res = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateSettings",
          isEnabled: settingsForm.isEnabled,
          rewardReferrerCents: Math.round(parseFloat(settingsForm.rewardReferrer) * 100),
          rewardRefereeCents: Math.round(parseFloat(settingsForm.rewardReferee) * 100),
          rewardType: settingsForm.rewardType,
          terms: settingsForm.terms || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setShowSettingsModal(false);
        fetchReferrals();
      } else {
        alert(data.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleIssueRewards(referralId: string) {
    if (!confirm("Issue rewards for this referral? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch("/api/admin/referrals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: referralId, action: "issueRewards" }),
      });

      const data = await res.json();

      if (res.ok) {
        fetchReferrals();
        setShowDetailModal(false);
        alert("Rewards issued successfully!");
      } else {
        alert(data.error || "Failed to issue rewards");
      }
    } catch (error) {
      console.error("Error issuing rewards:", error);
      alert("Failed to issue rewards");
    }
  }

  async function handleCloseReferral(referralId: string) {
    if (!confirm("Close this referral? This will mark it as no longer active.")) {
      return;
    }

    try {
      const res = await fetch("/api/admin/referrals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: referralId, action: "close" }),
      });

      const data = await res.json();

      if (res.ok) {
        fetchReferrals();
        setShowDetailModal(false);
      } else {
        alert(data.error || "Failed to close referral");
      }
    } catch (error) {
      console.error("Error closing referral:", error);
      alert("Failed to close referral");
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "NEW":
        return "bg-gray-100 text-gray-800";
      case "INVITED":
        return "bg-blue-100 text-blue-800";
      case "SIGNED_UP":
        return "bg-purple-100 text-purple-800";
      case "CONVERTED":
        return "bg-green-100 text-green-800";
      case "REWARDED":
        return "bg-teal-100 text-teal-800";
      case "CLOSED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "NEW":
        return "New";
      case "INVITED":
        return "Invited";
      case "SIGNED_UP":
        return "Signed Up";
      case "CONVERTED":
        return "Converted";
      case "REWARDED":
        return "Rewarded";
      case "CLOSED":
        return "Closed";
      default:
        return status;
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
          <h1 className="text-2xl font-bold text-gray-900">Referrals</h1>
          <p className="text-gray-600">Track referral program and rewards</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchReferrals}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Settings className="w-4 h-4" />
            Program Settings
          </button>
        </div>
      </div>

      {/* Program Status Banner */}
      {settings && !settings.isEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <div>
            <p className="font-medium text-amber-900">Referral Program Disabled</p>
            <p className="text-sm text-amber-700">
              The referral program is currently turned off. Enable it in settings to allow customers to refer friends.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <Share2 className="w-4 h-4 text-gray-400" />
            <p className="text-sm text-gray-600">Total Referrals</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <p className="text-sm text-gray-600">Converted</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.converted}</p>
          {stats.total > 0 && (
            <p className="text-xs text-gray-500">
              {Math.round((stats.converted / stats.total) * 100)}% conversion rate
            </p>
          )}
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-blue-500" />
            <p className="text-sm text-gray-600">Pending</p>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <Gift className="w-4 h-4 text-teal-500" />
            <p className="text-sm text-gray-600">Rewards Issued</p>
          </div>
          <p className="text-2xl font-bold text-teal-600">{formatCurrency(stats.totalRewardsIssued)}</p>
        </div>
      </div>

      {/* Current Rewards Info */}
      {settings && (
        <div className="bg-gradient-to-r from-teal-50 to-green-50 rounded-lg p-4 border border-teal-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                <Gift className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Current Rewards</p>
                <p className="text-sm text-gray-600">
                  Referrer gets {formatCurrency(settings.rewardReferrerCents / 100)} •
                  Referee gets {formatCurrency(settings.rewardRefereeCents / 100)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="text-teal-600 hover:text-teal-700 text-sm font-medium flex items-center gap-1"
            >
              Edit <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
                placeholder="Search by name, email, or code..."
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
            <option value="NEW">New</option>
            <option value="INVITED">Invited</option>
            <option value="SIGNED_UP">Signed Up</option>
            <option value="CONVERTED">Converted</option>
            <option value="REWARDED">Rewarded</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : referrals.length === 0 ? (
          <div className="p-12 text-center">
            <Share2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No referrals found</p>
            <p className="text-sm text-gray-400 mt-1">
              Referrals will appear here when customers share their referral links
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Referrer</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Referee</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Code</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Rewards</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((referral) => (
                  <tr key={referral.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{referral.referrerName}</p>
                      {referral.referrerEmail && (
                        <p className="text-sm text-gray-500">{referral.referrerEmail}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => {
                          setSelectedReferral(referral);
                          setShowDetailModal(true);
                        }}
                        className="text-left hover:text-teal-600"
                      >
                        <p className="font-medium text-gray-900">{referral.refereeName}</p>
                        <p className="text-sm text-gray-500">{referral.refereeEmail}</p>
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {referral.referralCode}
                        </code>
                        <button
                          onClick={() => copyCode(referral.referralCode)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          {copiedCode === referral.referralCode ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          referral.status
                        )}`}
                      >
                        {getStatusLabel(referral.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {referral.rewards.referrer > 0 || referral.rewards.referee > 0 ? (
                        <div className="text-sm">
                          <p className="text-teal-600 font-medium">
                            {formatCurrency((referral.rewards.referrer + referral.rewards.referee) / 100)}
                          </p>
                          <p className="text-xs text-gray-500">issued</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {formatDate(referral.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedReferral(referral);
                          setShowDetailModal(true);
                        }}
                        className="text-teal-600 hover:text-teal-700 text-sm font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Program Settings</h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveSettings} className="p-6 space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Enable Program</p>
                  <p className="text-sm text-gray-500">Allow customers to refer friends</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSettingsForm({ ...settingsForm, isEnabled: !settingsForm.isEnabled })
                  }
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    settingsForm.isEnabled ? "bg-teal-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      settingsForm.isEnabled ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referrer Reward
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settingsForm.rewardReferrer}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, rewardReferrer: e.target.value })
                    }
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Amount the referrer receives when their friend signs up
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referee Reward
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settingsForm.rewardReferee}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, rewardReferee: e.target.value })
                    }
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Amount the new customer receives when they sign up
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reward Type
                </label>
                <select
                  value={settingsForm.rewardType}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, rewardType: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="ACCOUNT_CREDIT">Account Credit</option>
                  <option value="COUPON">Discount Coupon</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Terms & Conditions (optional)
                </label>
                <textarea
                  value={settingsForm.terms}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, terms: e.target.value })
                  }
                  placeholder="Enter any terms or conditions for the referral program..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {savingSettings ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedReferral && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Referral Details</h2>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                      selectedReferral.status
                    )}`}
                  >
                    {getStatusLabel(selectedReferral.status)}
                  </span>
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
              {/* Referrer */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Referrer</p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{selectedReferral.referrerName}</p>
                      {selectedReferral.referrerEmail && (
                        <p className="text-sm text-gray-500">{selectedReferral.referrerEmail}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <code className="text-sm font-mono bg-white px-2 py-1 rounded border border-gray-200">
                      {selectedReferral.referralCode}
                    </code>
                    <button
                      onClick={() => copyCode(selectedReferral.referralCode)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      {copiedCode === selectedReferral.referralCode ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Referee */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Referred Friend</p>
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{selectedReferral.refereeName}</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-4 h-4" />
                      {selectedReferral.refereeEmail}
                    </div>
                    {selectedReferral.refereePhone && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-4 h-4" />
                        {selectedReferral.refereePhone}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Timeline</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">Referred on</span>
                    <span className="font-medium text-gray-900">
                      {formatDate(selectedReferral.createdAt)}
                    </span>
                  </div>
                  {selectedReferral.convertedAt && (
                    <div className="flex items-center gap-3 text-sm">
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="text-gray-600">Converted on</span>
                      <span className="font-medium text-gray-900">
                        {formatDate(selectedReferral.convertedAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Rewards */}
              {(selectedReferral.rewards.referrer > 0 || selectedReferral.rewards.referee > 0) && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Rewards Issued</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-teal-50 p-3 rounded-lg">
                      <p className="text-xs text-teal-600">Referrer</p>
                      <p className="text-lg font-bold text-teal-700">
                        {formatCurrency(selectedReferral.rewards.referrer / 100)}
                      </p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-xs text-green-600">Referee</p>
                      <p className="text-lg font-bold text-green-700">
                        {formatCurrency(selectedReferral.rewards.referee / 100)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              {(selectedReferral.status === "CONVERTED" || selectedReferral.status === "SIGNED_UP") && (
                <div className="flex gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleCloseReferral(selectedReferral.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Close Referral
                  </button>
                  {selectedReferral.status === "CONVERTED" && (
                    <button
                      onClick={() => handleIssueRewards(selectedReferral.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-white bg-teal-600 rounded-lg hover:bg-teal-700"
                    >
                      <DollarSign className="w-4 h-4" />
                      Issue Rewards
                    </button>
                  )}
                </div>
              )}

              {selectedReferral.status !== "CONVERTED" &&
               selectedReferral.status !== "SIGNED_UP" &&
               selectedReferral.status !== "REWARDED" &&
               selectedReferral.status !== "CLOSED" && (
                <div className="pt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleCloseReferral(selectedReferral.id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Close Referral
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
