"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Check,
  X,
  Eye,
  AlertCircle,
  FileText,
} from "lucide-react";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
}

interface ChangeRequest {
  id: string;
  requestType: string;
  requestTypeDisplay: string;
  status: string;
  title: string;
  description: string | null;
  currentValue: Record<string, unknown> | null;
  requestedValue: Record<string, unknown> | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  client: Client | null;
  resolvedBy: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
  } | null;
}

interface RequestType {
  value: string;
  label: string;
}

interface Stats {
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  dismissed: number;
}

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DISMISSED", label: "Dismissed" },
];

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function ChangeRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    open: 0,
    inProgress: 0,
    completed: 0,
    dismissed: 0,
  });
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("OPEN");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [clientFilter, setClientFilter] = useState<string>("");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modal state
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChangeRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);
      if (clientFilter) params.set("clientId", clientFilter);
      params.set("page", page.toString());
      params.set("limit", limit.toString());

      const res = await fetch(`/api/admin/change-requests?${params}`);
      const data = await res.json();

      if (res.ok) {
        setChangeRequests(data.changeRequests || []);
        setStats(data.stats || { total: 0, open: 0, inProgress: 0, completed: 0, dismissed: 0 });
        setRequestTypes(data.requestTypes || []);
        setTotalItems(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        setError(data.error || "Failed to load change requests");
      }
    } catch (err) {
      console.error("Error fetching change requests:", err);
      setError("Failed to load change requests");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, clientFilter, page, limit]);

  useEffect(() => {
    fetchChangeRequests();
  }, [fetchChangeRequests]);

  const resetFilters = () => {
    setStatusFilter("OPEN");
    setTypeFilter("");
    setClientFilter("");
    setPage(1);
  };

  const handleStatusChange = async (id: string, newStatus: string, resolutionNotes?: string) => {
    setUpdating(true);
    try {
      const res = await fetch("/api/admin/change-requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus, resolutionNotes }),
      });

      if (res.ok) {
        fetchChangeRequests();
        setShowDetailModal(false);
        setSelectedRequest(null);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update change request");
      }
    } catch (err) {
      console.error("Error updating change request:", err);
      setError("Failed to update change request");
    } finally {
      setUpdating(false);
    }
  };

  const openDetailModal = (request: ChangeRequest) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const startItem = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, totalItems);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Change Requests</h1>
        </div>
        <button
          onClick={fetchChangeRequests}
          disabled={loading}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Status Filter */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Change Requests Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-w-[150px]"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Change Requests Type</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-w-[200px]"
            >
              <option value="">
                {requestTypes.length > 0
                  ? `All Types (+${requestTypes.length} others)`
                  : "All Types"}
              </option>
              {requestTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Client Filter */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Client</label>
            <select
              value={clientFilter}
              onChange={(e) => {
                setClientFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-w-[150px]"
            >
              <option value="">All Clients</option>
              {/* Clients would be populated from a separate API call if needed */}
            </select>
          </div>

          {/* Reset Filters */}
          <button
            onClick={resetFilters}
            className="text-teal-600 hover:text-teal-700 text-sm font-medium py-2"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Clients
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Requests
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
                  </td>
                </tr>
              ) : changeRequests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                    No data available
                  </td>
                </tr>
              ) : (
                changeRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatDate(request.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {request.client ? (
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {request.client.fullName}
                          </p>
                          {request.client.email && (
                            <p className="text-xs text-gray-500">{request.client.email}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Unknown client</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {request.requestTypeDisplay}
                        </p>
                        <p className="text-xs text-gray-500">{request.title}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openDetailModal(request)}
                          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {request.status === "OPEN" && (
                          <>
                            <button
                              onClick={() => handleStatusChange(request.id, "COMPLETED")}
                              className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg"
                              title="Mark Complete"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleStatusChange(request.id, "DISMISSED")}
                              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                              title="Dismiss"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Items per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 border border-gray-200 rounded text-sm"
            >
              {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {startItem}-{endItem} of {totalItems}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50 disabled:hover:bg-transparent"
                title="First page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50 disabled:hover:bg-transparent"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50 disabled:hover:bg-transparent"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages || totalPages === 0}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50 disabled:hover:bg-transparent"
                title="Last page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Change Request Details</h2>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedRequest(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    selectedRequest.status === "OPEN"
                      ? "bg-blue-100 text-blue-700"
                      : selectedRequest.status === "IN_PROGRESS"
                      ? "bg-yellow-100 text-yellow-700"
                      : selectedRequest.status === "COMPLETED"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {selectedRequest.status}
                </span>
              </div>

              {/* Request Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-500">Request Type</h3>
                <p className="text-gray-900">{selectedRequest.requestTypeDisplay}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Title</h3>
                <p className="text-gray-900">{selectedRequest.title}</p>
              </div>

              {selectedRequest.description && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Description</h3>
                  <p className="text-gray-900">{selectedRequest.description}</p>
                </div>
              )}

              {/* Client Info */}
              {selectedRequest.client && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Client</h3>
                  <p className="text-gray-900">{selectedRequest.client.fullName}</p>
                  {selectedRequest.client.email && (
                    <p className="text-sm text-gray-500">{selectedRequest.client.email}</p>
                  )}
                  {selectedRequest.client.phone && (
                    <p className="text-sm text-gray-500">{selectedRequest.client.phone}</p>
                  )}
                </div>
              )}

              {/* Values */}
              {selectedRequest.currentValue && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Current Value</h3>
                  <pre className="text-sm text-gray-900 bg-gray-50 p-2 rounded overflow-auto">
                    {JSON.stringify(selectedRequest.currentValue, null, 2)}
                  </pre>
                </div>
              )}

              {selectedRequest.requestedValue && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Requested Value</h3>
                  <pre className="text-sm text-gray-900 bg-gray-50 p-2 rounded overflow-auto">
                    {JSON.stringify(selectedRequest.requestedValue, null, 2)}
                  </pre>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Created</h3>
                  <p className="text-gray-900">{formatDate(selectedRequest.createdAt)}</p>
                </div>
                {selectedRequest.resolvedAt && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Resolved</h3>
                    <p className="text-gray-900">{formatDate(selectedRequest.resolvedAt)}</p>
                  </div>
                )}
              </div>

              {selectedRequest.resolvedBy && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Resolved By</h3>
                  <p className="text-gray-900">{selectedRequest.resolvedBy.fullName}</p>
                </div>
              )}

              {selectedRequest.resolutionNotes && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Resolution Notes</h3>
                  <p className="text-gray-900">{selectedRequest.resolutionNotes}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            {selectedRequest.status === "OPEN" && (
              <div className="p-6 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => handleStatusChange(selectedRequest.id, "COMPLETED")}
                  disabled={updating}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Mark Complete
                </button>
                <button
                  onClick={() => handleStatusChange(selectedRequest.id, "DISMISSED")}
                  disabled={updating}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
