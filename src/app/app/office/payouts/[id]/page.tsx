"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  RefreshCw,
  AlertTriangle,
  Download,
  ExternalLink,
  User,
  FileText,
} from "lucide-react";

interface PayoutDetails {
  id: string;
  status: string;
  created: string;
  arrivalDate: string;
  grossCents: number;
  feeCents: number;
  netCents: number;
  tipCents: number;
  currency: string;
}

interface Transaction {
  id: string;
  type: string;
  amountCents: number;
  feeCents: number;
  netCents: number;
  tipCents: number;
  customerName: string | null;
  customerEmail: string | null;
  invoiceNumber: string | null;
  invoiceId: string | null;
  clientId: string | null;
  created: string;
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

function escapeCSV(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generatePayoutCSV(payout: PayoutDetails, transactions: Transaction[]): string {
  const headers = [
    "Payout ID",
    "Status",
    "Date Created",
    "Arrival Date",
    "Payout Amount",
    "Amount",
    "Fee",
    "Net",
    "Tip",
    "Customer Full Name",
    "Customer Email",
    "Invoice No.",
  ];

  const rows = transactions.map((txn) => [
    escapeCSV(payout.id),
    escapeCSV(payout.status),
    escapeCSV(formatDate(payout.created)),
    escapeCSV(formatDate(payout.arrivalDate)),
    escapeCSV((payout.netCents / 100).toFixed(2)),
    escapeCSV((txn.amountCents / 100).toFixed(2)),
    escapeCSV((txn.feeCents / 100).toFixed(2)),
    escapeCSV((txn.netCents / 100).toFixed(2)),
    escapeCSV((txn.tipCents / 100).toFixed(2)),
    escapeCSV(txn.customerName),
    escapeCSV(txn.customerEmail),
    escapeCSV(txn.invoiceNumber),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function PayoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [payout, setPayout] = useState<PayoutDetails | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchPayoutDetails();
  }, [id]);

  async function fetchPayoutDetails() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payouts/${id}`);
      const data = await res.json();

      if (res.ok) {
        setPayout(data.payout);
        setTransactions(data.transactions || []);
      } else {
        setError(data.error || "Failed to load payout details");
      }
    } catch (err) {
      console.error("Error fetching payout details:", err);
      setError("Failed to load payout details");
    } finally {
      setLoading(false);
    }
  }

  function handleExportCSV() {
    if (payout && transactions.length > 0) {
      const csv = generatePayoutCSV(payout, transactions);
      const dateStr = formatDate(payout.created).replace(/\//g, "-");
      downloadCSV(csv, `payout-${payout.id}-${dateStr}.csv`);
    }
  }

  // Pagination
  const totalPages = Math.ceil(transactions.length / itemsPerPage);
  const paginatedTransactions = transactions.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Link
          href="/app/office/payouts"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      </div>
    );
  }

  if (!payout) {
    return (
      <div className="space-y-6">
        <Link
          href="/app/office/payouts"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <div className="text-gray-500">Payout not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/app/office/payouts"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            Payout ID: {payout.id}
          </h1>
          <p className="text-gray-600">
            Date Created: <span className="font-medium">{formatDate(payout.created)}</span>
          </p>
          <p className="text-gray-600">
            Arrival date: <span className="font-medium">{formatDate(payout.arrivalDate)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPayoutDetails}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Gross Amount</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(payout.grossCents)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Fee Amount</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(payout.feeCents)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Net Amount</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(payout.netCents)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Tip Amount</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(payout.tipCents)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Items</h2>
          <button
            onClick={handleExportCSV}
            disabled={transactions.length === 0}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No transactions found for this payout
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Fee
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Net
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Tip
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Customer Full Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Customer Email
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Invoice No.
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedTransactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                        {formatCurrency(txn.amountCents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        {formatCurrency(txn.feeCents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                        {formatCurrency(txn.netCents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        {formatCurrency(txn.tipCents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {txn.customerName || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {txn.customerEmail || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {txn.invoiceNumber || "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {txn.clientId && (
                            <Link
                              href={`/app/office/clients/${txn.clientId}`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded"
                            >
                              View Client
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                          {txn.invoiceId && (
                            <Link
                              href={`/app/office/invoices/${txn.invoiceId}`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded"
                            >
                              View Invoice
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">Items per page:</span>
                  <span className="text-sm text-gray-700">{itemsPerPage}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">
                    {(page - 1) * itemsPerPage + 1}-
                    {Math.min(page * itemsPerPage, transactions.length)} of{" "}
                    {transactions.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      title="First page"
                    >
                      {"<<"}
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      title="Previous page"
                    >
                      {"<"}
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      title="Next page"
                    >
                      {">"}
                    </button>
                    <button
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      title="Last page"
                    >
                      {">>"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
