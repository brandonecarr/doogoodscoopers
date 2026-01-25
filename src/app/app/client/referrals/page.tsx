"use client";

import { useState, useEffect } from "react";
import {
  Share2,
  Copy,
  CheckCircle,
  Clock,
  DollarSign,
  Gift,
  Users,
  Send,
} from "lucide-react";

interface ReferralStats {
  totalReferrals: number;
  converted: number;
  pending: number;
  totalEarned: number;
  availableCredit: number;
}

interface Referral {
  id: string;
  refereeName: string;
  refereeEmail: string | null;
  refereePhone: string | null;
  status: string;
  createdAt: string;
  convertedAt: string | null;
}

interface ReferralProgram {
  isEnabled: boolean;
  referrerReward: number;
  refereeReward: number;
  rewardType: string;
  terms: string;
}

export default function ReferralsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [referralLink, setReferralLink] = useState("");
  const [program, setProgram] = useState<ReferralProgram | null>(null);
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrals: 0,
    converted: 0,
    pending: 0,
    totalEarned: 0,
    availableCredit: 0,
  });
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copied, setCopied] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchReferrals() {
      try {
        const res = await fetch("/api/client/referrals");
        const data = await res.json();

        if (res.ok) {
          setReferralCode(data.referralCode);
          setReferralLink(data.referralLink);
          setProgram(data.program);
          setStats(data.stats);
          setReferrals(data.referrals || []);
        } else {
          setError(data.error || "Failed to load referrals");
        }
      } catch (err) {
        console.error("Error fetching referrals:", err);
        setError("Failed to load referrals");
      } finally {
        setLoading(false);
      }
    }

    fetchReferrals();
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleSubmitReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/client/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setReferrals((prev) => [
          {
            id: data.referral.id,
            refereeName: data.referral.refereeName,
            refereeEmail: formData.email || null,
            refereePhone: formData.phone || null,
            status: "PENDING",
            createdAt: new Date().toISOString(),
            convertedAt: null,
          },
          ...prev,
        ]);
        setStats((prev) => ({
          ...prev,
          totalReferrals: prev.totalReferrals + 1,
          pending: prev.pending + 1,
        }));
        setFormData({ name: "", email: "", phone: "" });
        setShowForm(false);
      } else {
        setError(data.error);
      }
    } catch (err) {
      console.error("Error submitting referral:", err);
      setError("Failed to submit referral");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (!program?.isEnabled) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Refer a Friend</h1>
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Referral Program Coming Soon
          </h3>
          <p className="text-gray-500 text-sm">
            Check back later for referral rewards!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-xl font-bold text-gray-900">Refer a Friend</h1>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Reward Banner */}
      <div className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <p className="text-teal-100 text-sm">Earn for every referral</p>
            <p className="text-2xl font-bold">{formatCurrency(program.referrerReward)}</p>
          </div>
        </div>
        <p className="text-teal-100 text-sm">
          Your friend also gets {formatCurrency(program.refereeReward)} off their first service!
        </p>
      </div>

      {/* Share Link */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Share2 className="w-5 h-5 text-teal-600" />
          Your Referral Link
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={referralLink}
            readOnly
            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 truncate"
          />
          <button
            onClick={copyLink}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              copied
                ? "bg-green-100 text-green-700"
                : "bg-teal-600 text-white hover:bg-teal-700"
            }`}
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Share this link with friends and family
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl shadow-sm p-3 text-center">
          <Users className="w-5 h-5 text-teal-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-gray-900">{stats.totalReferrals}</p>
          <p className="text-xs text-gray-500">Referrals</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-3 text-center">
          <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-gray-900">{stats.converted}</p>
          <p className="text-xs text-gray-500">Converted</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-3 text-center">
          <DollarSign className="w-5 h-5 text-teal-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalEarned)}</p>
          <p className="text-xs text-gray-500">Earned</p>
        </div>
      </div>

      {/* Submit Referral Form */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-teal-600" />
            <span className="font-medium text-gray-900">Submit a Referral</span>
          </div>
          <span className="text-gray-400">{showForm ? "−" : "+"}</span>
        </button>

        {showForm && (
          <form onSubmit={handleSubmitReferral} className="p-4 pt-0 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Friend&apos;s Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="John Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="(555) 123-4567"
              />
            </div>
            <p className="text-xs text-gray-500">* Email or phone required</p>
            <button
              type="submit"
              disabled={submitting || !formData.name || (!formData.email && !formData.phone)}
              className="w-full bg-teal-600 text-white py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-teal-700 transition-colors"
            >
              {submitting ? "Submitting..." : "Submit Referral"}
            </button>
          </form>
        )}
      </div>

      {/* Referral History */}
      {referrals.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Your Referrals</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {referrals.map((referral) => (
              <div key={referral.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{referral.refereeName}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(referral.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    referral.status === "CONVERTED"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {referral.status === "CONVERTED" ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <Clock className="w-3 h-3" />
                  )}
                  {referral.status === "CONVERTED" ? "Converted" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terms */}
      {program.terms && (
        <p className="text-xs text-gray-500 text-center px-4">{program.terms}</p>
      )}
    </div>
  );
}
