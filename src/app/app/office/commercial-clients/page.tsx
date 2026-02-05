"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  X,
  AlertCircle,
  Eye,
  Filter,
  CheckCircle,
  Pause,
  AlertTriangle,
  Ban,
  Info,
} from "lucide-react";

interface CommercialClient {
  id: string;
  businessName: string;
  status: string;
  email: string | null;
  phone: string | null;
  primaryAddress: string | null;
  locationCount: number;
}

interface Stats {
  total: number;
  active: number;
  paused: number;
  canceled: number;
}

const CLIENT_STATUSES = ["ACTIVE", "PAUSED", "CANCELED"];

const CLEANUP_FREQUENCIES = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Every 2 Weeks" },
  { value: "MONTHLY", label: "Monthly" },
];

const BILLING_OPTIONS = [
  { value: "PER_VISIT", label: "Per Visit" },
  { value: "FLAT_RATE", label: "Flat Rate" },
];

const BILLING_INTERVALS = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Every 2 Weeks" },
  { value: "MONTHLY", label: "Monthly" },
];

const CONTACT_PRIORITIES = [
  { value: "PRIMARY", label: "Primary" },
  { value: "SECONDARY", label: "Secondary" },
  { value: "BILLING", label: "Billing Only" },
];

const CONTACT_ROLES = [
  { value: "OWNER", label: "Owner" },
  { value: "MANAGER", label: "Manager" },
  { value: "PROPERTY_MANAGER", label: "Property Manager" },
  { value: "BILLING", label: "Billing Contact" },
  { value: "OTHER", label: "Other" },
];

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

function getStatusBadge(status: string) {
  switch (status) {
    case "ACTIVE":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
          <CheckCircle className="w-3 h-3" />
          Active
        </span>
      );
    case "PAUSED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-full">
          <Pause className="w-3 h-3" />
          Paused
        </span>
      );
    case "CANCELED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full">
          <Ban className="w-3 h-3" />
          Canceled
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full">
          {status}
        </span>
      );
  }
}

export default function CommercialClientsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<CommercialClient[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, paused: 0, canceled: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE");
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Form state for creating commercial client
  const [form, setForm] = useState({
    // General Info
    businessName: "",
    taxExempt: false,
    singleInvoiceForAllLocations: false,
    // Location Info
    locationName: "",
    // Billing Contact
    firstName: "",
    lastName: "",
    companyName: "",
    contactPriority: "PRIMARY",
    contactRole: "OWNER",
    email: "",
    phone: "",
    smsConsent: false,
    billingAddress: "",
    billingCity: "",
    billingState: "",
    billingZip: "",
    receiveJobNotifications: false,
    receiveInvoicesViaEmail: true,
    clientPortalAccess: false,
    showContactInFieldApp: false,
    // Notification settings
    notifyOffSchedule: false,
    notifyOnTheWay: false,
    notifyCompleted: false,
    notificationMethod: "EMAIL",
    // Service Address
    serviceStreet: "",
    serviceCity: "",
    serviceState: "",
    serviceZip: "",
    // Service Info
    serviceName: "",
    cleanupFrequency: "WEEKLY",
    billingOption: "PER_VISIT",
    billingInterval: "MONTHLY",
    pricePerVisit: "",
    startOfBillingCycle: "",
    initialCleanupRequired: false,
  });

  useEffect(() => {
    fetchClients();
  }, [statusFilter, page, itemsPerPage]);

  async function fetchClients() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("type", "COMMERCIAL");
      if (statusFilter) params.set("status", statusFilter);
      if (searchQuery) params.set("search", searchQuery);
      params.set("page", page.toString());
      params.set("limit", itemsPerPage.toString());

      const res = await fetch(`/api/admin/clients?${params}`);
      const data = await res.json();

      if (res.ok) {
        // Transform data to match commercial client structure
        const commercialClients = (data.clients || []).map((c: {
          id: string;
          companyName: string | null;
          firstName: string | null;
          lastName: string | null;
          status: string;
          email: string | null;
          phone: string | null;
          primaryAddress: string | null;
        }) => ({
          id: c.id,
          businessName: c.companyName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed',
          status: c.status,
          email: c.email,
          phone: c.phone,
          primaryAddress: c.primaryAddress,
          locationCount: 1, // TODO: Get actual location count
        }));
        setClients(commercialClients);
        setStats(data.stats || { total: 0, active: 0, paused: 0, canceled: 0 });
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error("Error fetching commercial clients:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchClients();
  }

  function openCreateModal() {
    setForm({
      businessName: "",
      taxExempt: false,
      singleInvoiceForAllLocations: false,
      locationName: "",
      firstName: "",
      lastName: "",
      companyName: "",
      contactPriority: "PRIMARY",
      contactRole: "OWNER",
      email: "",
      phone: "",
      smsConsent: false,
      billingAddress: "",
      billingCity: "",
      billingState: "",
      billingZip: "",
      receiveJobNotifications: false,
      receiveInvoicesViaEmail: true,
      clientPortalAccess: false,
      showContactInFieldApp: false,
      notifyOffSchedule: false,
      notifyOnTheWay: false,
      notifyCompleted: false,
      notificationMethod: "EMAIL",
      serviceStreet: "",
      serviceCity: "",
      serviceState: "",
      serviceZip: "",
      serviceName: "",
      cleanupFrequency: "WEEKLY",
      billingOption: "PER_VISIT",
      billingInterval: "MONTHLY",
      pricePerVisit: "",
      startOfBillingCycle: "",
      initialCleanupRequired: false,
    });
    setShowModal(true);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Create the commercial client
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientType: "COMMERCIAL",
          companyName: form.businessName,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email || null,
          phone: form.phone || null,
          taxExempt: form.taxExempt,
          // Address
          addressLine1: form.billingAddress,
          city: form.billingCity,
          state: form.billingState,
          zipCode: form.billingZip,
          // Service location
          serviceAddress: form.serviceStreet,
          serviceCity: form.serviceCity,
          serviceState: form.serviceState,
          serviceZip: form.serviceZip,
          // Preferences
          receiveJobNotifications: form.receiveJobNotifications,
          receiveInvoicesViaEmail: form.receiveInvoicesViaEmail,
          clientPortalAccess: form.clientPortalAccess,
          // Subscription details (if creating with subscription)
          frequency: form.cleanupFrequency,
          pricePerVisitCents: form.pricePerVisit ? Math.round(parseFloat(form.pricePerVisit) * 100) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create commercial client");
      }

      setShowModal(false);
      fetchClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create client");
    } finally {
      setSaving(false);
    }
  }

  const filteredClients = clients.filter(
    (c) =>
      c.businessName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commercial Clients</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchClients}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Plus className="w-4 h-4" />
            CREATE NEW
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 text-teal-600 hover:bg-teal-50 rounded-lg"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? "Hide Filters" : "Show Filters"}
          </button>
        </form>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">All Statuses</option>
                  {CLIENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0) + status.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Client List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No data available</p>
          </div>
        ) : (
          <>
            <div>
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Business Name
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredClients.map((client) => (
                    <tr
                      key={client.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/app/office/clients/${client.id}`)}
                    >
                      <td className="px-4 py-3">
                        {getStatusBadge(client.status)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{client.businessName}</p>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => router.push(`/app/office/clients/${client.id}`)}
                          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
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
                    setPage(1);
                  }}
                  className="px-2 py-1 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-sm text-gray-500">
                  {filteredClients.length > 0
                    ? `${(page - 1) * itemsPerPage + 1}-${Math.min(page * itemsPerPage, stats.total)} of ${stats.total}`
                    : "0-0 of 0"}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                Create New Commercial Client
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-4 space-y-6">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                {/* General Info Section */}
                <div className="bg-gray-100 -mx-4 px-4 py-2">
                  <h3 className="font-medium text-gray-900">General Info</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Business Name *
                    </label>
                    <input
                      type="text"
                      value={form.businessName}
                      onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.taxExempt}
                      onChange={(e) => setForm({ ...form, taxExempt: e.target.checked })}
                      className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-gray-700">Tax exempt</span>
                  </label>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.singleInvoiceForAllLocations}
                        onChange={(e) => setForm({ ...form, singleInvoiceForAllLocations: e.target.checked })}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-700">Receive a single invoice for all locations</span>
                    </label>
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-700">
                        Note: Receive a single invoice option cannot be changed later!
                      </p>
                    </div>
                  </div>
                </div>

                {/* Location Info Section */}
                <div className="bg-gray-100 -mx-4 px-4 py-2">
                  <h3 className="font-medium text-gray-900">Location 1 Info</h3>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Location 1 Name *
                  </label>
                  <input
                    type="text"
                    value={form.locationName}
                    onChange={(e) => setForm({ ...form, locationName: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>

                {/* Billing Contact Section */}
                <div className="bg-gray-100 -mx-4 px-4 py-2">
                  <h3 className="font-medium text-gray-900">Billing Contact</h3>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">First Name *</label>
                      <input
                        type="text"
                        value={form.firstName}
                        onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Last Name *</label>
                      <input
                        type="text"
                        value={form.lastName}
                        onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Company Name *</label>
                    <input
                      type="text"
                      value={form.companyName}
                      onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Contact Priority *</label>
                      <select
                        value={form.contactPriority}
                        onChange={(e) => setForm({ ...form, contactPriority: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      >
                        {CONTACT_PRIORITIES.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Role *</label>
                      <select
                        value={form.contactRole}
                        onChange={(e) => setForm({ ...form, contactRole: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      >
                        {CONTACT_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={form.smsConsent}
                      onChange={(e) => setForm({ ...form, smsConsent: e.target.checked })}
                      className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 mt-1"
                    />
                    <span className="text-xs text-gray-600">
                      By checking this box, the client agrees to receive marketing and promotional text messages at the phone number provided. Message frequency may vary. Message and data rates may apply. The client may reply HELP for assistance or STOP to opt out.
                    </span>
                  </label>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Billing Address *</label>
                    <input
                      type="text"
                      value={form.billingAddress}
                      onChange={(e) => setForm({ ...form, billingAddress: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">City *</label>
                      <input
                        type="text"
                        value={form.billingCity}
                        onChange={(e) => setForm({ ...form, billingCity: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">State *</label>
                      <select
                        value={form.billingState}
                        onChange={(e) => setForm({ ...form, billingState: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      >
                        <option value="">Select...</option>
                        {US_STATES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">ZIP Code *</label>
                      <input
                        type="text"
                        value={form.billingZip}
                        onChange={(e) => setForm({ ...form, billingZip: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    Country: United States
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.receiveJobNotifications}
                        onChange={(e) => setForm({ ...form, receiveJobNotifications: e.target.checked })}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-700">Receive job notifications</span>
                    </label>

                    {form.receiveJobNotifications && (
                      <div className="ml-6 space-y-3 pt-2">
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">Cleanup Notification Type</label>
                          <div className="space-y-1">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={form.notifyOffSchedule}
                                onChange={(e) => setForm({ ...form, notifyOffSchedule: e.target.checked })}
                                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                              />
                              <span className="text-sm text-gray-600">Off-Schedule</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={form.notifyOnTheWay}
                                onChange={(e) => setForm({ ...form, notifyOnTheWay: e.target.checked })}
                                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                              />
                              <span className="text-sm text-gray-600">On the Way</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={form.notifyCompleted}
                                onChange={(e) => setForm({ ...form, notifyCompleted: e.target.checked })}
                                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                              />
                              <span className="text-sm text-gray-600">Completed</span>
                            </label>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">Cleanup Notification Method</label>
                          <select
                            value={form.notificationMethod}
                            onChange={(e) => setForm({ ...form, notificationMethod: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          >
                            <option value="EMAIL">Email</option>
                            <option value="TEXT">Text</option>
                            <option value="CALL">Call</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.receiveInvoicesViaEmail}
                        onChange={(e) => setForm({ ...form, receiveInvoicesViaEmail: e.target.checked })}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-700">Receive invoices via email</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.clientPortalAccess}
                        onChange={(e) => setForm({ ...form, clientPortalAccess: e.target.checked })}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-700">Client portal access</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.showContactInFieldApp}
                        onChange={(e) => setForm({ ...form, showContactInFieldApp: e.target.checked })}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-700">Show contact&apos;s name, phone and email within the field tech app</span>
                    </label>
                  </div>
                </div>

                {/* Service Address Section */}
                <div className="bg-gray-100 -mx-4 px-4 py-2">
                  <h3 className="font-medium text-gray-900">Service Address</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Service Street *</label>
                    <input
                      type="text"
                      value={form.serviceStreet}
                      onChange={(e) => setForm({ ...form, serviceStreet: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">City *</label>
                      <input
                        type="text"
                        value={form.serviceCity}
                        onChange={(e) => setForm({ ...form, serviceCity: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">State *</label>
                      <select
                        value={form.serviceState}
                        onChange={(e) => setForm({ ...form, serviceState: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      >
                        <option value="">Select...</option>
                        {US_STATES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">ZIP Code *</label>
                      <input
                        type="text"
                        value={form.serviceZip}
                        onChange={(e) => setForm({ ...form, serviceZip: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    Country: United States
                  </div>
                </div>

                {/* Service Info Section */}
                <div className="bg-gray-100 -mx-4 px-4 py-2">
                  <h3 className="font-medium text-gray-900">Service Info</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Service Name *</label>
                    <input
                      type="text"
                      value={form.serviceName}
                      onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Cleanup Frequency *</label>
                      <select
                        value={form.cleanupFrequency}
                        onChange={(e) => setForm({ ...form, cleanupFrequency: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      >
                        {CLEANUP_FREQUENCIES.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Billing Option *</label>
                      <select
                        value={form.billingOption}
                        onChange={(e) => setForm({ ...form, billingOption: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      >
                        {BILLING_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Billing Interval *</label>
                      <select
                        value={form.billingInterval}
                        onChange={(e) => setForm({ ...form, billingInterval: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      >
                        {BILLING_INTERVALS.map((i) => (
                          <option key={i.value} value={i.value}>{i.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Price *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.pricePerVisit}
                          onChange={(e) => setForm({ ...form, pricePerVisit: e.target.value })}
                          required
                          className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Start of Billing Cycle *</label>
                    <input
                      type="date"
                      value={form.startOfBillingCycle}
                      onChange={(e) => setForm({ ...form, startOfBillingCycle: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.initialCleanupRequired}
                      onChange={(e) => setForm({ ...form, initialCleanupRequired: e.target.checked })}
                      className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-gray-700">Initial cleanup required</span>
                  </label>
                </div>

                {/* Info Box */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700 font-medium">After you create new commercial client:</p>
                  <ul className="mt-1 text-sm text-blue-600 list-disc list-inside">
                    <li>New commercial subscription will be created.</li>
                    <li>Office staff will need to assign field tech/s and service day/s to the new commercial location.</li>
                  </ul>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-100 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "SAVE"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
