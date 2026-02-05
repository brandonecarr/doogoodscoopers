"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  DollarSign,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertTriangle,
  Truck,
  Ban,
  Eye,
  Download,
  Cloud,
} from "lucide-react";
import {
  generateMultiplePayoutsCSV,
  downloadCSV,
  type PayoutForCSV,
  type TransactionForCSV,
} from "@/components/billing/PayoutCSVExport";

type PayoutStatus = "paid" | "pending" | "in_transit" | "canceled" | "failed";

interface Payout {
  id: string;
  status: PayoutStatus;
  created: string;
  arrivalDate: string;
  amountCents: number;
  currency: string;
  itemCount: number;
  tipCents: number;
}

function getStatusIcon(status: PayoutStatus) {
  switch (status) {
    case "paid":
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case "pending":
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case "in_transit":
      return <Truck className="w-4 h-4 text-blue-500" />;
    case "canceled":
      return <Ban className="w-4 h-4 text-gray-500" />;
    case "failed":
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
  }
}

function getStatusColor(status: PayoutStatus) {
  switch (status) {
    case "paid":
      return "text-green-700 bg-green-100";
    case "pending":
      return "text-yellow-700 bg-yellow-100";
    case "in_transit":
      return "text-blue-700 bg-blue-100";
    case "canceled":
      return "text-gray-700 bg-gray-100";
    case "failed":
      return "text-red-700 bg-red-100";
  }
}

function getStatusLabel(status: PayoutStatus) {
  switch (status) {
    case "paid":
      return "SUCCESS";
    case "pending":
      return "PENDING";
    case "in_transit":
      return "IN TRANSIT";
    case "canceled":
      return "CANCELED";
    case "failed":
      return "FAILED";
  }
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(isoString: string) {
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function PayoutsPage() {
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [startingAfter, setStartingAfter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pageHistory, setPageHistory] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchPayouts();
  }, [itemsPerPage]);

  async function fetchPayouts(cursor?: string) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", itemsPerPage.toString());
      if (cursor) {
        params.set("starting_after", cursor);
      }

      const res = await fetch(`/api/admin/payouts?${params}`);
      const data = await res.json();

      if (res.ok) {
        setPayouts(data.payouts || []);
        setHasMore(data.hasMore || false);
        setStartingAfter(data.pagination?.startingAfter || null);
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

  function handleNextPage() {
    if (startingAfter) {
      setPageHistory([...pageHistory, payouts[0]?.id || ""]);
      fetchPayouts(startingAfter);
    }
  }

  function handlePrevPage() {
    if (pageHistory.length > 0) {
      const newHistory = [...pageHistory];
      newHistory.pop();
      setPageHistory(newHistory);
      const prevCursor = newHistory.length > 0 ? newHistory[newHistory.length - 1] : undefined;
      fetchPayouts(prevCursor);
    } else {
      fetchPayouts();
    }
  }

  function handleRefresh() {
    setPageHistory([]);
    fetchPayouts();
  }

  async function handleExportCSV() {
    if (payouts.length === 0) return;

    setExporting(true);
    setError(null);

    try {
      // Fetch details for each payout on the current page
      const payoutsWithTransactions: Array<{
        payout: PayoutForCSV;
        transactions: TransactionForCSV[];
      }> = [];

      for (const payout of payouts) {
        const res = await fetch(`/api/admin/payouts/${payout.id}`);
        if (res.ok) {
          const data = await res.json();
          payoutsWithTransactions.push({
            payout: {
              id: data.payout.id,
              status: data.payout.status,
              created: data.payout.created,
              arrivalDate: data.payout.arrivalDate,
              netCents: data.payout.netCents,
            },
            transactions: data.transactions.map((txn: {
              amountCents: number;
              feeCents: number;
              netCents: number;
              tipCents: number;
              customerName: string | null;
              customerEmail: string | null;
              invoiceNumber: string | null;
            }) => ({
              amountCents: txn.amountCents,
              feeCents: txn.feeCents,
              netCents: txn.netCents,
              tipCents: txn.tipCents,
              customerName: txn.customerName,
              customerEmail: txn.customerEmail,
              invoiceNumber: txn.invoiceNumber,
            })),
          });
        }
      }

      if (payoutsWithTransactions.length > 0) {
        const csv = generateMultiplePayoutsCSV(payoutsWithTransactions);
        const today = new Date().toISOString().split("T")[0];
        downloadCSV(csv, `payouts-${today}.csv`);
      }
    } catch (err) {
      console.error("Error exporting CSV:", err);
      setError("Failed to export CSV");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
          <p className="text-gray-600">View Stripe payouts to your bank account</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={exporting || payouts.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            <Cloud className="w-4 h-4" />
            {exporting ? "Exporting..." : "CSV"}
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Payouts List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {loading && payouts.length === 0 ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : payouts.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No payouts found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Date Created
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Arrival Date
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Tip
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Items
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payouts.map((payout) => (
                    <tr key={payout.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            payout.status
                          )}`}
                        >
                          {getStatusIcon(payout.status)}
                          {getStatusLabel(payout.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(payout.created)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(payout.arrivalDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                        {formatCurrency(payout.amountCents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {formatCurrency(payout.tipCents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {payout.itemCount}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/app/office/payouts/${payout.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg"
                        >
                          View
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">Items per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(parseInt(e.target.value));
                    setPageHistory([]);
                  }}
                  className="px-2 py-1 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={pageHistory.length === 0 || loading}
                  className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={!hasMore || loading}
                  className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
