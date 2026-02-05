"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Download,
  ChevronDown,
  Eye,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Mail,
  Trash2,
  CheckSquare,
  ExternalLink,
  Ban,
  FileText,
  X,
  Building,
  Home,
  Calendar,
} from "lucide-react";
import {
  CSVExportModal,
  generateInvoicesCSV,
  downloadCSV,
} from "@/components/billing/CSVExportModal";
import type {
  RecurringInvoice,
  RecurringInvoiceStats,
  InvoiceStatus,
  BillingOption,
  PaymentMethod,
  ClientType,
} from "@/lib/billing/types";
import {
  BILLING_OPTION_LABELS,
  BILLING_INTERVAL_LABELS,
  PAYMENT_METHOD_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/billing/types";

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: "PAID", label: "Paid" },
  { value: "DRAFT", label: "Draft" },
  { value: "OPEN", label: "Open" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "VOID", label: "Voided" },
  { value: "FAILED", label: "Failed" },
];

const BILLING_OPTION_OPTIONS: { value: BillingOption; label: string }[] = [
  { value: "PREPAID_FIXED", label: "Prepaid Fixed" },
  { value: "PREPAID_VARIABLE", label: "Prepaid Variable" },
  { value: "POSTPAID", label: "Postpaid" },
];

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "CHECK", label: "Check" },
  { value: "CASH", label: "Cash" },
  { value: "ACH", label: "ACH" },
];

const CLIENT_TYPE_OPTIONS: { value: ClientType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "COMMERCIAL", label: "Commercial" },
];

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDateTime(dateString: string): { date: string; time: string } {
  const date = new Date(dateString);
  return {
    date: date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
  };
}

export default function RecurringInvoicesPage() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<RecurringInvoice[]>([]);
  const [stats, setStats] = useState<RecurringInvoiceStats>({
    draft: { count: 0, amountCents: 0 },
    open: { count: 0, amountCents: 0 },
    overdue: { count: 0, amountCents: 0 },
    paid: { count: 0, amountCents: 0 },
    failed: { count: 0, amountCents: 0 },
    totalAmountCents: 0,
    totalTipsCents: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<InvoiceStatus[]>([]);
  const [billingOption, setBillingOption] = useState<BillingOption | "">("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [clientType, setClientType] = useState<ClientType | "ALL">("ALL");
  const [showZeroInvoices, setShowZeroInvoices] = useState(false);
  const [withTips, setWithTips] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dropdowns
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [activeRowMenu, setActiveRowMenu] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  const actionsRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setShowActionsMenu(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
      if (rowMenuRef.current && !rowMenuRef.current.contains(event.target as Node)) {
        setActiveRowMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch invoices
  useEffect(() => {
    fetchInvoices();
  }, [pagination.page, pagination.limit]);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());

      if (searchQuery) params.set("search", searchQuery);
      if (selectedStatuses.length > 0) params.set("status", selectedStatuses.join(","));
      if (fromDate) params.set("startDate", fromDate);
      if (toDate) params.set("endDate", toDate);
      if (billingOption) params.set("billingOption", billingOption);
      if (paymentMethod) params.set("paymentMethod", paymentMethod);
      if (clientType !== "ALL") params.set("clientType", clientType);
      if (showZeroInvoices) params.set("showZeroInvoices", "true");
      if (withTips) params.set("withTips", "true");

      const res = await fetch(`/api/admin/recurring-invoices?${params}`);
      const data = await res.json();

      if (res.ok) {
        setInvoices(data.invoices || []);
        setStats(data.stats || {});
        setPagination((prev) => ({
          ...prev,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 1,
        }));
      } else {
        console.error("Failed to fetch invoices:", data.error);
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchInvoices();
  }

  function handleClearFilters() {
    setSearchQuery("");
    setFromDate("");
    setToDate("");
    setSelectedStatuses([]);
    setBillingOption("");
    setPaymentMethod("");
    setClientType("ALL");
    setShowZeroInvoices(false);
    setWithTips(false);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  function toggleStatus(status: InvoiceStatus) {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  }

  // Selection handlers
  function handleSelectAll() {
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map((inv) => inv.id)));
    }
  }

  function handleSelectOne(id: string) {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  }

  // Bulk actions
  async function handleBulkAction(action: "finalize" | "email" | "delete") {
    if (selectedIds.size === 0) return;

    const confirmMessages: Record<string, string> = {
      finalize: `Finalize ${selectedIds.size} selected invoice(s)?`,
      email: `Email ${selectedIds.size} selected invoice(s)?`,
      delete: `Delete ${selectedIds.size} selected invoice(s)? Only draft invoices will be deleted.`,
    };

    if (!confirm(confirmMessages[action])) return;

    try {
      const res = await fetch("/api/admin/recurring-invoices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          invoiceIds: Array.from(selectedIds),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(data.message);
        setSelectedIds(new Set());
        fetchInvoices();
      } else {
        alert(data.error || `Failed to ${action} invoices`);
      }
    } catch (error) {
      console.error(`Error ${action} invoices:`, error);
      alert(`Failed to ${action} invoices`);
    }

    setShowActionsMenu(false);
  }

  // Single invoice actions
  async function handleVoidInvoice(id: string) {
    if (!confirm("Are you sure you want to void this invoice?")) return;

    try {
      const res = await fetch(`/api/admin/recurring-invoices?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchInvoices();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to void invoice");
      }
    } catch (error) {
      console.error("Error voiding invoice:", error);
      alert("Failed to void invoice");
    }

    setActiveRowMenu(null);
  }

  // CSV Export
  function handleExportCSV(startDate: string, endDate: string, applyToView: boolean) {
    if (applyToView) {
      setFromDate(startDate);
      setToDate(endDate);
    }

    const csvContent = generateInvoicesCSV(invoices, startDate, endDate);
    const filename = `Recurring Invoices ${startDate} - ${endDate}.csv`;
    downloadCSV(csvContent, filename);
  }

  // Pagination
  const startIndex = (pagination.page - 1) * pagination.limit + 1;
  const endIndex = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Recurring Invoices</h1>
        <div className="flex items-center gap-3">
          {/* CSV Export Button */}
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>

          {/* Actions Dropdown */}
          <div className="relative" ref={actionsRef}>
            <button
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
            >
              ACTIONS
              <ChevronDown className="w-4 h-4" />
            </button>
            {showActionsMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <button
                  onClick={() => handleBulkAction("finalize")}
                  disabled={selectedIds.size === 0}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <CheckSquare className="w-4 h-4 text-teal-500" />
                  Finalize Invoices
                </button>
                <button
                  onClick={() => handleBulkAction("email")}
                  disabled={selectedIds.size === 0}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Mail className="w-4 h-4 text-teal-500" />
                  Email Invoices
                </button>
                <button
                  onClick={() => handleBulkAction("delete")}
                  disabled={selectedIds.size === 0}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Invoices
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search and Filters Toggle */}
      <div className="flex items-center justify-between mb-4">
        <form onSubmit={handleSearch} className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </form>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-teal-600 hover:text-teal-700"
        >
          <Filter className="w-4 h-4" />
          {showFilters ? "Hide" : "Show"} Filters
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {/* From Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-3 h-3 inline mr-1" />
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-3 h-3 inline mr-1" />
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Status Multi-Select */}
            <div className="relative" ref={statusDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <button
                type="button"
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg bg-white text-left"
              >
                <span className="text-sm truncate">
                  {selectedStatuses.length === 0
                    ? "All Statuses"
                    : `${selectedStatuses.length} selected`}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              {showStatusDropdown && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                  {STATUS_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes(opt.value)}
                        onChange={() => toggleStatus(opt.value)}
                        className="rounded border-gray-300 text-teal-500 focus:ring-teal-500"
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Billing Option */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Billing Option
              </label>
              <select
                value={billingOption}
                onChange={(e) => setBillingOption(e.target.value as BillingOption | "")}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="">All Options</option>
                {BILLING_OPTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | "")}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="">All Methods</option>
                {PAYMENT_METHOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Client Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Type
              </label>
              <select
                value={clientType}
                onChange={(e) => setClientType(e.target.value as ClientType | "ALL")}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                {CLIENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Checkboxes and Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showZeroInvoices}
                  onChange={(e) => setShowZeroInvoices(e.target.checked)}
                  className="rounded border-gray-300 text-teal-500 focus:ring-teal-500"
                />
                <span className="text-sm text-gray-700">Show $0 Invoices</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={withTips}
                  onChange={(e) => setWithTips(e.target.checked)}
                  className="rounded border-gray-300 text-teal-500 focus:ring-teal-500"
                />
                <span className="text-sm text-gray-700">Invoices With Tips</span>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleClearFilters}
                className="text-sm text-teal-600 hover:text-teal-700"
              >
                Clear Filters
              </button>
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
              >
                GO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Invoices Total</span>
            <FileText className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-teal-600">{formatCurrency(stats.totalAmountCents)}</p>
          {stats.totalTipsCents > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Includes {formatCurrency(stats.totalTipsCents)} in Tips!
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Stats by Status */}
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center min-w-[80px]">
            <p className="text-xs text-gray-500 mb-1">Draft</p>
            <p className="text-lg font-semibold text-gray-700">{formatCurrency(stats.draft.amountCents)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center min-w-[80px]">
            <p className="text-xs text-gray-500 mb-1">Open</p>
            <p className="text-lg font-semibold text-blue-600">{formatCurrency(stats.open.amountCents)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center min-w-[80px]">
            <p className="text-xs text-gray-500 mb-1">Overdue</p>
            <p className="text-lg font-semibold text-red-600">{formatCurrency(stats.overdue.amountCents)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center min-w-[80px]">
            <p className="text-xs text-gray-500 mb-1">Paid</p>
            <p className="text-lg font-semibold text-green-600">{formatCurrency(stats.paid.amountCents)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center min-w-[80px]">
            <p className="text-xs text-gray-500 mb-1">Failed</p>
            <p className="text-lg font-semibold text-red-600">{formatCurrency(stats.failed.amountCents)}</p>
          </div>
        </div>
      </div>

      {/* Item Count */}
      <div className="text-sm text-gray-500 mb-2 text-right">
        {startIndex}-{endIndex} of {pagination.total}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === invoices.length && invoices.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-teal-500 focus:ring-teal-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Client Type
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Date Created
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Invoices #
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Payment Method
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Billing Option
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Billing Interval
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                  Invoice Total
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                  Tip
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                  Invoice Remaining
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                      Loading invoices...
                    </div>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    No recurring invoices found
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => {
                  const { date, time } = formatDateTime(invoice.createdAt);
                  const statusColors = STATUS_COLORS[invoice.status] || STATUS_COLORS.DRAFT;

                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(invoice.id)}
                          onChange={() => handleSelectOne(invoice.id)}
                          className="rounded border-gray-300 text-teal-500 focus:ring-teal-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            invoice.client.type === "RESIDENTIAL"
                              ? "bg-teal-100 text-teal-600"
                              : "bg-blue-100 text-blue-600"
                          }`}
                          title={invoice.client.type}
                        >
                          {invoice.client.type === "RESIDENTIAL" ? (
                            <Home className="w-4 h-4" />
                          ) : (
                            <Building className="w-4 h-4" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="text-gray-900">{date}</div>
                        <div className="text-gray-500 text-xs">{time}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/app/office/invoices/${invoice.id}`}
                          className="text-teal-600 hover:text-teal-700 hover:underline text-sm font-medium"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/app/office/clients/${invoice.client.id}`}
                          className="text-teal-600 hover:text-teal-700 hover:underline text-sm"
                        >
                          {invoice.client.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {invoice.paymentMethod
                          ? PAYMENT_METHOD_LABELS[invoice.paymentMethod]
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${statusColors.bg} ${statusColors.text}`}
                        >
                          {STATUS_LABELS[invoice.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {BILLING_OPTION_LABELS[invoice.billingOption] || invoice.billingOption}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {BILLING_INTERVAL_LABELS[invoice.billingInterval] || invoice.billingInterval}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                        {formatCurrency(invoice.totalCents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-right">
                        {formatCurrency(invoice.tipCents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-right">
                        {formatCurrency(invoice.remainingCents)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/app/office/invoices/${invoice.id}`}
                            className="p-1.5 text-teal-500 hover:bg-teal-50 rounded"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {/* More Menu */}
                          <div className="relative" ref={activeRowMenu === invoice.id ? rowMenuRef : null}>
                            <button
                              onClick={() =>
                                setActiveRowMenu(activeRowMenu === invoice.id ? null : invoice.id)
                              }
                              className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            {activeRowMenu === invoice.id && (
                              <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                                <a
                                  href={`/app/office/invoices/${invoice.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  View in new tab
                                </a>
                                {invoice.status !== "PAID" && invoice.status !== "VOID" && (
                                  <button
                                    onClick={() => handleVoidInvoice(invoice.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                  >
                                    <Ban className="w-4 h-4" />
                                    Void
                                  </button>
                                )}
                                <button
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  onClick={() => setActiveRowMenu(null)}
                                >
                                  <Download className="w-4 h-4" />
                                  Download
                                </button>
                                <button
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  onClick={() => setActiveRowMenu(null)}
                                >
                                  <Mail className="w-4 h-4" />
                                  Email
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Items per page:</span>
            <select
              value={pagination.limit}
              onChange={(e) => {
                setPagination((prev) => ({
                  ...prev,
                  limit: Number(e.target.value),
                  page: 1,
                }));
              }}
              className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {startIndex}-{endIndex} of {pagination.total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: 1 }))}
                disabled={pagination.page === 1}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    page: Math.min(prev.totalPages, prev.page + 1),
                  }))
                }
                disabled={pagination.page === pagination.totalPages}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.totalPages }))}
                disabled={pagination.page === pagination.totalPages}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CSV Export Modal */}
      <CSVExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        invoices={invoices}
        onExport={handleExportCSV}
      />
    </div>
  );
}
