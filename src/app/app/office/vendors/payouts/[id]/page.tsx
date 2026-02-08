"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, CheckCircle } from "lucide-react";

interface PayoutDetail {
  id: string;
  vendorId: string;
  vendorName: string | null;
  vendorPayoutMethod: string | null;
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

interface PayoutItem {
  id: string;
  jobAddOnId: string | null;
  description: string;
  amountCents: number;
  createdAt: string;
}

export default function VendorPayoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [payout, setPayout] = useState<PayoutDetail | null>(null);
  const [items, setItems] = useState<PayoutItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPayout();
  }, [id]);

  async function fetchPayout() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/vendor-payouts/${id}`);
      const data = await res.json();

      if (res.ok) {
        setPayout(data.payout);
        setItems(data.items || []);
      } else {
        setError(data.error || "Failed to load payout");
      }
    } catch (err) {
      console.error("Error fetching payout:", err);
      setError("Failed to load payout");
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkPaid() {
    if (!payout || !confirm("Mark this payout as paid?")) return;

    try {
      const res = await fetch("/api/admin/vendor-payouts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: payout.id, status: "PAID" }),
      });

      if (res.ok) fetchPayout();
    } catch (err) {
      console.error("Error marking payout as paid:", err);
    }
  }

  async function handleCancel() {
    if (!payout || !confirm("Cancel this payout?")) return;

    try {
      const res = await fetch("/api/admin/vendor-payouts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: payout.id, status: "CANCELED" }),
      });

      if (res.ok) fetchPayout();
    } catch (err) {
      console.error("Error canceling payout:", err);
    }
  }

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  if (error || !payout) {
    return (
      <div className="space-y-4">
        <Link href="/app/office/vendors/payouts" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Back to Payouts
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error || "Payout not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/app/office/vendors/payouts" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Payouts
      </Link>

      {/* Payout Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{formatCurrency(payout.amountCents)}</h1>
              <p className="text-gray-600">
                Payout to{" "}
                <Link href={`/app/office/vendors/${payout.vendorId}`} className="text-teal-600 hover:underline">
                  {payout.vendorName || "Unknown Vendor"}
                </Link>
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${
            payout.status === "PAID" ? "bg-green-100 text-green-700" :
            payout.status === "CANCELED" ? "bg-red-100 text-red-700" :
            "bg-yellow-100 text-yellow-700"
          }`}>
            {payout.status}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500">Period</p>
            <p className="font-medium text-gray-900">
              {new Date(payout.periodStart).toLocaleDateString()} - {new Date(payout.periodEnd).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Payout Method</p>
            <p className="font-medium text-gray-900">{payout.payoutMethod || payout.vendorPayoutMethod || "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Reference #</p>
            <p className="font-medium text-gray-900">{payout.referenceNumber || "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{payout.paidAt ? "Paid At" : "Created"}</p>
            <p className="font-medium text-gray-900">
              {new Date(payout.paidAt || payout.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {payout.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Notes</p>
            <p className="text-sm text-gray-700">{payout.notes}</p>
          </div>
        )}

        {/* Actions */}
        {payout.status === "PENDING" && (
          <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={handleMarkPaid}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4" /> Mark as Paid
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
            >
              Cancel Payout
            </button>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Line Items ({items.length})</h2>
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No line items for this payout.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-gray-900">{item.description}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <p className="font-semibold text-gray-900">{formatCurrency(item.amountCents)}</p>
              </div>
            ))}
            <div className="flex items-center justify-between p-4 bg-gray-50">
              <p className="font-semibold text-gray-900">Total</p>
              <p className="font-bold text-gray-900">{formatCurrency(payout.amountCents)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
