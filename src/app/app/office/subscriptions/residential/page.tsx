"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  Filter,
  Download,
  ChevronDown,
  Eye,
  Pause,
  X,
  Info,
  Plus,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreVertical,
} from "lucide-react";

interface Subscription {
  id: string;
  status: "ACTIVE" | "PENDING" | "PAUSED" | "CANCELED" | "PAST_DUE";
  pricePerVisitCents: number;
  frequency: string;
  billingOption: string;
  billingInterval: string;
  endOfBillingPeriod: string | null;
  clientId: string;
  clientName: string;
  startDate: string;
  endDate: string | null;
  planName: string | null;
  terminationReason: string | null;
  terminationComment: string | null;
  tip: number | null;
  address: string;
  isCleanupSubscription: boolean;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(dateString: string | null) {
  if (!dateString) return "No data";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getStatusColor(status: string) {
  switch (status) {
    case "ACTIVE":
      return "text-teal-600";
    case "PENDING":
      return "text-amber-500";
    case "PAUSED":
      return "text-yellow-600";
    case "CANCELED":
      return "text-gray-500";
    case "PAST_DUE":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
}

function getFrequencyLabel(frequency: string): string {
  const labels: Record<string, string> = {
    WEEKLY: "weekly",
    TWICE_WEEKLY: "twice weekly",
    BIWEEKLY: "bi-weekly",
    MONTHLY: "monthly",
    ONETIME: "one-time",
  };
  return labels[frequency] || frequency.toLowerCase();
}

export default function ResidentialSubscriptionsPage() {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<Subscription[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const actionsRef = useRef<HTMLDivElement>(null);

  // Close actions menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setShowActionsMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch subscriptions
  useEffect(() => {
    fetchSubscriptions();
  }, []);

  // Filter subscriptions when search or filters change
  useEffect(() => {
    let filtered = subscriptions;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (sub) =>
          sub.clientName.toLowerCase().includes(query) ||
          sub.planName?.toLowerCase().includes(query)
      );
    }

    if (statusFilter) {
      filtered = filtered.filter((sub) => sub.status === statusFilter);
    }

    setFilteredSubscriptions(filtered);
    setCurrentPage(1);
  }, [subscriptions, searchQuery, statusFilter]);

  async function fetchSubscriptions() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/subscriptions");
      if (response.ok) {
        const data = await response.json();
        // Transform the data
        const transformed: Subscription[] = (data.subscriptions || [])
          .filter((sub: any) => {
            // Filter to residential clients only (no company name)
            return !sub.client?.company_name;
          })
          .map((sub: any) => {
            // Build full address
            const loc = sub.location;
            const address = loc
              ? `${loc.address_line1 || ""}${loc.address_line2 ? " " + loc.address_line2 : ""}, ${loc.city || ""}, California ${loc.zip_code || ""}`.trim()
              : "No address";

            // Determine if it's a cleanup subscription (has "Regular" or "Premium" in plan name)
            const planName = sub.plan?.name || null;
            const isCleanup = planName
              ? planName.toLowerCase().includes("regular") || planName.toLowerCase().includes("premium")
              : false;

            return {
              id: sub.id,
              status: sub.status || "ACTIVE",
              pricePerVisitCents: sub.price_per_visit_cents || 0,
              frequency: sub.frequency || "MONTHLY",
              billingOption: "Prepaid Fixed",
              billingInterval: "Monthly",
              endOfBillingPeriod: getEndOfBillingPeriod(),
              clientId: sub.client_id,
              clientName: sub.client
                ? `${sub.client.first_name} ${sub.client.last_name || ""}`.trim()
                : "Unknown",
              startDate: sub.created_at,
              endDate: sub.canceled_at || null,
              planName,
              terminationReason: sub.cancel_reason || null,
              terminationComment: null,
              tip: null,
              address,
              isCleanupSubscription: isCleanup,
            };
          });
        setSubscriptions(transformed);
        setFilteredSubscriptions(transformed);
      }
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
    } finally {
      setLoading(false);
    }
  }

  // Calculate end of billing period (first of next month)
  function getEndOfBillingPeriod(): string {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toISOString();
  }

  // Pagination calculations
  const totalItems = filteredSubscriptions.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentItems = filteredSubscriptions.slice(startIndex, endIndex);

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedIds.size === currentItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentItems.map((sub) => sub.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // CSV Export - matches Sweep&Go format
  const handleExportCSV = () => {
    const headers = [
      "Status",
      "Revenue",
      "Revenue Type",
      "Tip",
      "Billing Option",
      "Billing Interval",
      "End of Billing Period",
      "Client Name",
      "Start Date",
      "End Date",
      "Subs. Name",
      "Termination Reason",
      "Termination Comment",
      "Address",
    ];

    // Helper to escape CSV values
    const escapeCSV = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return `"${value}"`;
    };

    // Format date for CSV (YYYY-MM-DD)
    const formatDateCSV = (dateString: string | null) => {
      if (!dateString) return "No data";
      const date = new Date(dateString);
      return date.toISOString().split("T")[0];
    };

    const rows = filteredSubscriptions.map((sub) => [
      escapeCSV(sub.status.charAt(0) + sub.status.slice(1).toLowerCase()),
      escapeCSV((sub.pricePerVisitCents / 100).toFixed(2)),
      escapeCSV(getFrequencyLabel(sub.frequency)),
      escapeCSV(sub.tip ? (sub.tip / 100).toFixed(2) : "No data"),
      escapeCSV(sub.billingOption),
      escapeCSV(sub.billingInterval),
      escapeCSV(formatDateCSV(sub.endOfBillingPeriod)),
      escapeCSV(sub.clientName),
      escapeCSV(formatDateCSV(sub.startDate)),
      escapeCSV(sub.endDate ? formatDateCSV(sub.endDate) : "No data"),
      escapeCSV(sub.planName || "No data"),
      escapeCSV(sub.terminationReason || "No data"),
      escapeCSV(sub.terminationComment || "No data"),
      escapeCSV(sub.address),
    ]);

    // Calculate summary stats
    const cleanupCount = filteredSubscriptions.filter((s) => s.isCleanupSubscription).length;
    const additionalCount = filteredSubscriptions.length - cleanupCount;

    // Build CSV with summary at bottom
    const csvRows = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
      "", // Empty row
      `"Total:","${filteredSubscriptions.length}"`,
      `"Cleanup Subscriptions:","${cleanupCount}"`,
      `"Additional Service Subscriptions:","${additionalCount}"`,
    ];

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "Residential Subscriptions.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Residential Subscriptions
        </h1>
        <div className="flex items-center gap-3">
          {/* CSV Export */}
          <button
            onClick={handleExportCSV}
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
                <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <Plus className="w-4 h-4 text-teal-500" />
                  Create New
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <DollarSign className="w-4 h-4 text-teal-500" />
                  Change Price
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 max-w-md">
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
        </div>
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
        <div className="bg-gray-50 rounded-lg p-4 mb-4 flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="PAUSED">Paused</option>
              <option value="CANCELED">Canceled</option>
              <option value="PAST_DUE">Past Due</option>
            </select>
          </div>
        </div>
      )}

      {/* Count */}
      <div className="text-sm text-gray-500 mb-2 text-right">
        {startIndex + 1}-{endIndex} of {totalItems}
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
                    checked={selectedIds.size === currentItems.length && currentItems.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-teal-500 focus:ring-teal-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Revenue
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Tip
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Billing Option
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Billing Interval
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  End of Billing Period
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Client Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Start Date
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  End Date
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Subs. Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Termination Reason
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Termination Comment
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                      Loading subscriptions...
                    </div>
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-gray-500">
                    No subscriptions found
                  </td>
                </tr>
              ) : (
                currentItems.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(sub.id)}
                        onChange={() => handleSelectOne(sub.id)}
                        className="rounded border-gray-300 text-teal-500 focus:ring-teal-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${getStatusColor(sub.status)}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatCurrency(sub.pricePerVisitCents)}
                      <br />
                      <span className="text-gray-500 text-xs">
                        {getFrequencyLabel(sub.frequency)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {sub.tip ? formatCurrency(sub.tip) : "No data"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {sub.billingOption}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {sub.billingInterval}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="flex items-center gap-1">
                        <Info className="w-4 h-4 text-teal-500" />
                        {formatDate(sub.endOfBillingPeriod)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button className="text-gray-400 hover:text-gray-600">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        <a
                          href={`/app/office/clients/${sub.clientId}`}
                          className="text-teal-600 hover:text-teal-700 hover:underline"
                        >
                          {sub.clientName}
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatDate(sub.startDate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(sub.endDate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {sub.planName || "No data"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {sub.terminationReason || "No Data"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {sub.terminationComment || "No Data"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <a
                          href={`/app/office/subscriptions/${sub.id}`}
                          className="p-1.5 text-teal-500 hover:bg-teal-50 rounded"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        <button
                          className="p-1.5 text-amber-500 hover:bg-amber-50 rounded"
                          title="Pause"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Items per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
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
              {startIndex + 1}-{endIndex} of {totalItems}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
