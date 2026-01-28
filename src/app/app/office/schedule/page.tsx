"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  AlertCircle,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Pencil,
  Cloud,
  SlidersHorizontal,
  ArrowRightLeft,
  MapPin,
} from "lucide-react";
import { GoogleMapsProvider } from "@/components/route-planner/GoogleMapsProvider";
import { ScheduleMap } from "@/components/schedule/ScheduleMap";

interface ScheduleItem {
  id: string;
  locationId: string;
  clientId: string;
  clientName: string;
  clientFirstName: string;
  clientLastName: string;
  address: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number | null;
  longitude: number | null;
  assignedTo: string;
  assignedUserId: string | null;
  frequency: string;
  frequencyDisplay: string;
  preferredDay: string | null;
  pricePerVisitCents: number;
  planName: string | null;
  status: string;
  createdAt: string;
  dogCount: number;
}

interface Tech {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function ScheduleContent() {
  const searchParams = useSearchParams();

  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTechId, setSelectedTechId] = useState<string>("");
  const [selectedFrequency, setSelectedFrequency] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  const [viewMode, setViewMode] = useState<"table" | "map">("table");
  const [viewModeDropdownOpen, setViewModeDropdownOpen] = useState(false);
  const viewModeRef = useRef<HTMLDivElement>(null);

  const [actionsDropdownOpen, setActionsDropdownOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showChangeTechModal, setShowChangeTechModal] = useState(false);
  const [newTechId, setNewTechId] = useState<string>("");
  const [updating, setUpdating] = useState(false);

  // Fetch schedule data
  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());
      if (searchQuery) params.set("search", searchQuery);
      if (selectedTechId) params.set("techId", selectedTechId);
      if (selectedFrequency) params.set("frequency", selectedFrequency);

      const response = await fetch(`/api/admin/schedule?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch schedule");
      }

      const data = await response.json();
      setSchedule(data.schedule || []);
      setTechs(data.techs || []);
      setPagination(data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery, selectedTechId, selectedFrequency]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // Handle click outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (viewModeRef.current && !viewModeRef.current.contains(target)) {
        setViewModeDropdownOpen(false);
      }
      if (actionsRef.current && !actionsRef.current.contains(target)) {
        setActionsDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Handle page change
  const goToPage = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page }));
    }
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedItems.size === schedule.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(schedule.map((s) => s.id)));
    }
  };

  // Handle select item
  const handleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  // Handle change tech
  const handleChangeTech = async () => {
    if (selectedItems.size === 0) return;

    setUpdating(true);
    try {
      const response = await fetch("/api/admin/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionIds: Array.from(selectedItems),
          assignedTo: newTechId || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update");
      }

      setShowChangeTechModal(false);
      setSelectedItems(new Set());
      setNewTechId("");
      fetchSchedule();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setUpdating(false);
    }
  };

  // Format preferred day for display
  const formatServiceDay = (day: string | null): string => {
    if (!day) return "";
    const dayMap: Record<string, string> = {
      MONDAY: "Monday",
      TUESDAY: "Tuesday",
      WEDNESDAY: "Wednesday",
      THURSDAY: "Thursday",
      FRIDAY: "Friday",
      SATURDAY: "Saturday",
      SUNDAY: "Sunday",
    };
    return dayMap[day] || day;
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "Client Name",
      "Client Address",
      "City",
      "State",
      "Zip Code",
      "Subscription Name",
      "Subscription Status",
      "Service Days",
      "Assigned To",
      "Cleanup Frequency",
      "Number Of Dogs",
    ];

    const rows = schedule.map((item) => [
      item.clientName,
      item.address,
      item.city,
      item.state,
      item.zipCode,
      item.planName || "",
      item.status,
      formatServiceDay(item.preferredDay),
      item.assignedTo,
      item.frequencyDisplay,
      item.dogCount.toString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Master Schedule.csv`;
    link.click();
  };

  // Reset filters
  const resetFilters = () => {
    setSearchQuery("");
    setSelectedTechId("");
    setSelectedFrequency("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <GoogleMapsProvider>
      <div className="space-y-6">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          {/* Left side - Title and View Mode */}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">Schedule</h1>

            {/* View Mode Dropdown */}
            <div className="relative" ref={viewModeRef}>
              <button
                onClick={() => setViewModeDropdownOpen(!viewModeDropdownOpen)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
              >
                {viewMode === "table" ? "Table View" : "Map View"}
                <ChevronDown className="w-4 h-4" />
              </button>

              {viewModeDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-32 bg-white rounded shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    onClick={() => {
                      setViewMode("table");
                      setViewModeDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm ${
                      viewMode === "table"
                        ? "bg-teal-50 text-teal-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Table View
                  </button>
                  <button
                    onClick={() => {
                      setViewMode("map");
                      setViewModeDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm ${
                      viewMode === "map"
                        ? "bg-teal-50 text-teal-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Map View
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right side - CSV and Actions */}
          <div className="flex items-center gap-3">
            {/* CSV Export */}
            <button
              onClick={exportToCSV}
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <Cloud className="w-5 h-5" />
              <span>CSV</span>
            </button>

            {/* Actions Dropdown */}
            <div className="relative" ref={actionsRef}>
              <button
                onClick={() => setActionsDropdownOpen(!actionsDropdownOpen)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded hover:bg-teal-600"
              >
                ACTIONS
                <ChevronDown className="w-4 h-4" />
              </button>

              {actionsDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    onClick={() => {
                      setActionsDropdownOpen(false);
                      if (selectedItems.size === 0) {
                        alert("Please select at least one item");
                        return;
                      }
                      setShowChangeTechModal(true);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Change Tech
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search Row */}
        <div className="flex items-center gap-4">
          <form onSubmit={handleSearch} className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="w-full pl-4 pr-10 py-2 border-b border-gray-300 focus:border-teal-500 focus:outline-none bg-transparent"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          </form>

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {showFilters ? "Hide Filters" : "Show Filters"}
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cleanup Assigned To
              </label>
              <select
                value={selectedTechId}
                onChange={(e) => {
                  setSelectedTechId(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
              >
                <option value="">All Techs</option>
                {techs.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Frequency
              </label>
              <select
                value={selectedFrequency}
                onChange={(e) => {
                  setSelectedFrequency(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
              >
                <option value="">All Frequencies</option>
                <option value="WEEKLY">Once a week</option>
                <option value="BIWEEKLY">Bi weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="TWICE_WEEKLY">Twice a week</option>
                <option value="ONE_TIME">One time</option>
              </select>
            </div>

            <button
              onClick={resetFilters}
              className="mt-6 text-sm text-gray-500 hover:text-gray-700"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex items-center justify-center py-12 text-red-600">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}

        {/* Table View */}
        {!loading && !error && viewMode === "table" && (
          <div className="bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                      Location ID
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                      Client Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                      Address
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                      City
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                      Zip
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                      Cleanup Assigned To
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                      Service Frequency
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {schedule.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                        No schedule items found
                      </td>
                    </tr>
                  ) : (
                    schedule.map((item, index) => (
                      <tr
                        key={item.id}
                        className={index % 2 === 1 ? "bg-teal-50/30" : ""}
                        onClick={() => handleSelectItem(item.id)}
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/app/office/clients/${item.clientId}`}
                            className="text-sm text-teal-600 hover:text-teal-700 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item.locationId}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/app/office/clients/${item.clientId}`}
                            className="text-sm text-teal-600 hover:text-teal-700 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item.clientName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.address}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.city}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.zipCode}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.assignedTo}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.frequencyDisplay}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/app/office/clients/${item.clientId}`}
                              className="p-1.5 text-white bg-teal-500 hover:bg-teal-600 rounded"
                              title="View"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <Link
                              href={`/app/office/clients/${item.clientId}/edit`}
                              className="p-1.5 text-white bg-green-500 hover:bg-green-600 rounded"
                              title="Edit"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Pencil className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Items per page:</span>
                <select
                  value={pagination.limit}
                  onChange={(e) =>
                    setPagination((prev) => ({
                      ...prev,
                      limit: parseInt(e.target.value),
                      page: 1,
                    }))
                  }
                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  {pagination.total === 0
                    ? "0"
                    : `${(pagination.page - 1) * pagination.limit + 1}-${Math.min(
                        pagination.page * pagination.limit,
                        pagination.total
                      )}`}{" "}
                  of {pagination.total}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => goToPage(1)}
                    disabled={pagination.page === 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="First page"
                  >
                    <ChevronsLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => goToPage(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => goToPage(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Next page"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => goToPage(pagination.totalPages)}
                    disabled={pagination.page === pagination.totalPages}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Last page"
                  >
                    <ChevronsRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Map View */}
        {!loading && !error && viewMode === "map" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <ScheduleMap
              schedule={schedule}
              techs={techs}
              selectedTechId={selectedTechId}
              selectedFrequency={selectedFrequency}
            />
          </div>
        )}

        {/* Change Tech Modal */}
        {showChangeTechModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4">
              <div
                className="fixed inset-0 bg-black/30"
                onClick={() => setShowChangeTechModal(false)}
              />
              <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Change Tech
                </h3>

                <p className="text-sm text-gray-600 mb-4">
                  Assign {selectedItems.size} selected subscription
                  {selectedItems.size !== 1 ? "s" : ""} to a new tech.
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Tech
                  </label>
                  <select
                    value={newTechId}
                    onChange={(e) => setNewTechId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="">Unassigned</option>
                    {techs.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.fullName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowChangeTechModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    disabled={updating}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleChangeTech}
                    disabled={updating}
                    className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
                  >
                    {updating ? "Updating..." : "Change Tech"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </GoogleMapsProvider>
  );
}

export default function SchedulePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <ScheduleContent />
    </Suspense>
  );
}
