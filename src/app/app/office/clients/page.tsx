"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Search,
  RefreshCw,
  X,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Dog,
  Calendar,
  DollarSign,
  Ban,
  CheckCircle,
  Pause,
  AlertTriangle,
  ChevronDown,
  Eye,
} from "lucide-react";
import type { ClientStatus, Frequency } from "@/lib/supabase/types";

interface ClientSubscription {
  id: string;
  frequency: Frequency;
  pricePerVisitCents: number;
  nextServiceDate: string | null;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  clientType: "RESIDENTIAL" | "COMMERCIAL";
  status: ClientStatus;
  accountCreditCents: number;
  tags: string[];
  notes: string | null;
  referralSource: string | null;
  hasStripeCustomer: boolean;
  createdAt: string;
  updatedAt: string;
  primaryAddress: string | null;
  locationCount: number;
  dogCount: number;
  dogNames: string;
  subscription: ClientSubscription | null;
}

interface ClientStats {
  total: number;
  active: number;
  paused: number;
  canceled: number;
  delinquent: number;
}

const CLIENT_STATUSES: ClientStatus[] = ["ACTIVE", "PAUSED", "CANCELED", "DELINQUENT"];
const CLIENT_TYPES = ["RESIDENTIAL", "COMMERCIAL"] as const;

const REFERRAL_SOURCES = [
  "Google Search",
  "Facebook",
  "Instagram",
  "Nextdoor",
  "Yelp",
  "Friend/Family Referral",
  "Customer Referral",
  "Yard Sign",
  "Door Hanger",
  "Mailer",
  "Website",
  "Other",
] as const;

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Bi-Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "ONETIME", label: "One-Time" },
];

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;

function getStatusIcon(status: ClientStatus) {
  switch (status) {
    case "ACTIVE":
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case "PAUSED":
      return <Pause className="w-4 h-4 text-yellow-500" />;
    case "CANCELED":
      return <Ban className="w-4 h-4 text-gray-400" />;
    case "DELINQUENT":
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
  }
}

function getStatusColor(status: ClientStatus) {
  switch (status) {
    case "ACTIVE":
      return "text-green-700 bg-green-100";
    case "PAUSED":
      return "text-yellow-700 bg-yellow-100";
    case "CANCELED":
      return "text-gray-700 bg-gray-100";
    case "DELINQUENT":
      return "text-red-700 bg-red-100";
  }
}

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatFrequency(freq: Frequency) {
  const labels: Record<Frequency, string> = {
    TWICE_WEEKLY: "Twice Weekly",
    WEEKLY: "Weekly",
    BIWEEKLY: "Bi-weekly",
    MONTHLY: "Monthly",
    ONETIME: "One-time",
  };
  return labels[freq] || freq;
}

export default function ClientsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<ClientStats>({
    total: 0,
    active: 0,
    paused: 0,
    canceled: 0,
    delinquent: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Form state
  const [form, setForm] = useState({
    // Contact Info
    firstName: "",
    lastName: "",
    companyName: "",
    email: "",
    homePhone: "",
    cellPhone: "",
    clientType: "RESIDENTIAL" as "RESIDENTIAL" | "COMMERCIAL",
    status: "ACTIVE" as ClientStatus,
    notes: "",
    tags: [] as string[],
    // Location
    location: {
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "CA",
      zipCode: "",
      gateCode: "",
      accessNotes: "",
    },
    addZipToServiceArea: false,
    // Service Info
    numberOfDogs: 1,
    frequency: "WEEKLY" as Frequency,
    billingOption: "auto" as "auto" | "manual",
    billingInterval: "per-service" as "per-service" | "monthly",
    couponCode: "",
    referralSource: "",
    initialCleanupRequired: false,
    requestTosApproval: false,
    taxExempt: false,
    // Dogs (for detailed dog info)
    dogs: [{ name: "", breed: "", size: "", isSafe: true }],
  });

  useEffect(() => {
    fetchClients();
  }, [statusFilter, typeFilter, page, itemsPerPage]);

  async function fetchClients() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);
      if (searchQuery) params.set("search", searchQuery);
      params.set("page", page.toString());
      params.set("limit", itemsPerPage.toString());

      const res = await fetch(`/api/admin/clients?${params}`);
      const data = await res.json();

      if (res.ok) {
        setClients(data.clients || []);
        setStats(data.stats || { total: 0, active: 0, paused: 0, canceled: 0, delinquent: 0 });
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        setError(data.error || "Failed to load clients");
      }
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError("Failed to load clients");
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
    setEditingClient(null);
    setForm({
      firstName: "",
      lastName: "",
      companyName: "",
      email: "",
      homePhone: "",
      cellPhone: "",
      clientType: "RESIDENTIAL",
      status: "ACTIVE",
      notes: "",
      tags: [],
      location: {
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "CA",
        zipCode: "",
        gateCode: "",
        accessNotes: "",
      },
      addZipToServiceArea: false,
      numberOfDogs: 1,
      frequency: "WEEKLY",
      billingOption: "auto",
      billingInterval: "per-service",
      couponCode: "",
      referralSource: "",
      initialCleanupRequired: false,
      requestTosApproval: false,
      taxExempt: false,
      dogs: [{ name: "", breed: "", size: "", isSafe: true }],
    });
    setShowModal(true);
    setError(null);
  }

  function openEditModal(client: Client) {
    setEditingClient(client);
    setForm({
      firstName: client.firstName || "",
      lastName: client.lastName || "",
      companyName: client.companyName || "",
      email: client.email || "",
      homePhone: client.phone || "",
      cellPhone: "",
      clientType: client.clientType,
      status: client.status,
      referralSource: client.referralSource || "",
      notes: client.notes || "",
      tags: client.tags || [],
      location: {
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "CA",
        zipCode: "",
        gateCode: "",
        accessNotes: "",
      },
      addZipToServiceArea: false,
      numberOfDogs: 1,
      frequency: "WEEKLY",
      billingOption: "auto",
      billingInterval: "per-service",
      couponCode: "",
      initialCleanupRequired: false,
      requestTosApproval: false,
      taxExempt: false,
      dogs: [{ name: "", breed: "", size: "", isSafe: true }],
    });
    setShowModal(true);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const method = editingClient ? "PUT" : "POST";
      const body = editingClient
        ? {
            id: editingClient.id,
            firstName: form.firstName,
            lastName: form.lastName,
            companyName: form.companyName || null,
            email: form.email || null,
            phone: form.homePhone || null,
            secondaryPhone: form.cellPhone || null,
            clientType: form.clientType,
            status: form.status,
            referralSource: form.referralSource || null,
            notes: form.notes || null,
            tags: form.tags,
          }
        : {
            firstName: form.firstName,
            lastName: form.lastName,
            companyName: form.companyName || null,
            email: form.email || null,
            phone: form.homePhone || null,
            secondaryPhone: form.cellPhone || null,
            clientType: form.clientType,
            referralSource: form.referralSource || null,
            notes: form.notes || null,
            tags: form.tags,
            location: form.location.addressLine1 ? form.location : undefined,
            dogs: form.dogs.filter((d) => d.name),
            // Service info for subscription creation
            frequency: form.frequency,
            numberOfDogs: form.numberOfDogs,
            billingOption: form.billingOption,
            billingInterval: form.billingInterval,
            couponCode: form.couponCode || null,
            initialCleanupRequired: form.initialCleanupRequired,
            requestTosApproval: form.requestTosApproval,
            taxExempt: form.taxExempt,
            addZipToServiceArea: form.addZipToServiceArea,
          };

      const res = await fetch("/api/admin/clients", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchClients();
      } else {
        setError(data.error || "Failed to save client");
      }
    } catch (err) {
      console.error("Error saving client:", err);
      setError("Failed to save client");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(client: Client, newStatus: ClientStatus) {
    if (newStatus === "CANCELED") {
      if (!confirm(`Are you sure you want to cancel ${client.fullName}? This will cancel their subscriptions.`)) {
        return;
      }
    }

    try {
      const res = await fetch("/api/admin/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: client.id, status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to update status");
        return;
      }
      fetchClients();
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update status");
    }
  }

  function addDog() {
    setForm({
      ...form,
      dogs: [...form.dogs, { name: "", breed: "", size: "", isSafe: true }],
    });
  }

  function removeDog(index: number) {
    setForm({
      ...form,
      dogs: form.dogs.filter((_, i) => i !== index),
    });
  }

  function updateDog(index: number, field: string, value: string | boolean) {
    const newDogs = [...form.dogs];
    newDogs[index] = { ...newDogs[index], [field]: value };
    setForm({ ...form, dogs: newDogs });
  }

  const filteredClients = clients.filter(
    (c) =>
      c.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600">Manage customer accounts and subscriptions</p>
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
            Add Client
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-xl font-bold text-gray-900">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Pause className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Paused</p>
              <p className="text-xl font-bold text-gray-900">{stats.paused}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Delinquent</p>
              <p className="text-xl font-bold text-gray-900">{stats.delinquent}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Ban className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Canceled</p>
              <p className="text-xl font-bold text-gray-900">{stats.canceled}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or phone..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>
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
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">All Types</option>
            {CLIENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0) + type.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Search
          </button>
        </form>
      </div>

      {/* Client List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No clients found</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-teal-600 hover:text-teal-700 text-sm font-medium"
            >
              Add your first client
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Client
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Contact
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Location
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Subscription
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Status
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
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center text-white font-medium">
                            {client.firstName?.[0] || "?"}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{client.fullName}</p>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              {client.dogCount > 0 && (
                                <span className="flex items-center gap-1">
                                  <Dog className="w-3 h-3" />
                                  {client.dogCount} dog{client.dogCount !== 1 && "s"}
                                </span>
                              )}
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded">
                                {client.clientType}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {client.email && (
                            <p className="text-sm text-gray-600 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {client.email}
                            </p>
                          )}
                          {client.phone && (
                            <p className="text-sm text-gray-600 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {formatPhoneNumber(client.phone)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {client.primaryAddress ? (
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate max-w-[200px]">{client.primaryAddress}</span>
                          </p>
                        ) : (
                          <span className="text-sm text-gray-400">No address</span>
                        )}
                        {client.locationCount > 1 && (
                          <p className="text-xs text-gray-400 mt-1">
                            +{client.locationCount - 1} more location(s)
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {client.subscription ? (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-900">
                              {formatFrequency(client.subscription.frequency)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatCurrency(client.subscription.pricePerVisitCents)}/visit
                            </p>
                            {client.subscription.nextServiceDate && (
                              <p className="text-xs text-gray-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Next: {new Date(client.subscription.nextServiceDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No subscription</span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="relative group">
                          <button className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(client.status)}`}>
                            {getStatusIcon(client.status)}
                            {client.status}
                            <ChevronDown className="w-3 h-3" />
                          </button>
                          <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[120px]">
                            {CLIENT_STATUSES.filter((s) => s !== client.status).map((status) => (
                              <button
                                key={status}
                                onClick={() => handleStatusChange(client, status)}
                                className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                {getStatusIcon(status)}
                                {status.charAt(0) + status.slice(1).toLowerCase()}
                              </button>
                            ))}
                          </div>
                        </div>
                        {client.accountCreditCents > 0 && (
                          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {formatCurrency(client.accountCreditCents)} credit
                          </p>
                        )}
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
                  Page {page} of {totalPages}
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingClient ? "Edit Client" : "Add New Client"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* Contact Info Section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-teal-600" />
                  Contact Info
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Client Type
                    </label>
                    <select
                      value={form.clientType}
                      onChange={(e) =>
                        setForm({ ...form, clientType: e.target.value as "RESIDENTIAL" | "COMMERCIAL" })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                    >
                      <option value="RESIDENTIAL">Residential</option>
                      <option value="COMMERCIAL">Commercial</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Home Phone
                    </label>
                    <input
                      type="tel"
                      value={form.homePhone}
                      onChange={(e) => setForm({ ...form, homePhone: formatPhoneNumber(e.target.value) })}
                      placeholder="(555) 555-5555"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cell Phone
                    </label>
                    <input
                      type="tel"
                      value={form.cellPhone}
                      onChange={(e) => setForm({ ...form, cellPhone: formatPhoneNumber(e.target.value) })}
                      placeholder="(555) 555-5555"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                    />
                  </div>
                  {form.clientType === "COMMERCIAL" && (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={form.companyName}
                        onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Status (edit only) */}
              {editingClient && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">Status</h3>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as ClientStatus })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                  >
                    {CLIENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0) + status.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Location Section (create only) */}
              {!editingClient && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-teal-600" />
                    Location
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Home Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.location.addressLine1}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            location: { ...form.location, addressLine1: e.target.value },
                          })
                        }
                        required
                        placeholder="Start typing address..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        City <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.location.city}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            location: { ...form.location, city: e.target.value },
                          })
                        }
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          State <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={form.location.state}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              location: { ...form.location, state: e.target.value },
                            })
                          }
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                        >
                          {US_STATES.map((state) => (
                            <option key={state} value={state}>
                              {state}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ZIP Code <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.location.zipCode}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              location: { ...form.location, zipCode: e.target.value },
                            })
                          }
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                        />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.addZipToServiceArea}
                          onChange={(e) => setForm({ ...form, addZipToServiceArea: e.target.checked })}
                          className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        Add ZIP Code to Service Area
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Gate Code
                      </label>
                      <input
                        type="text"
                        value={form.location.gateCode}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            location: { ...form.location, gateCode: e.target.value },
                          })
                        }
                        placeholder="Optional"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Access Notes
                      </label>
                      <input
                        type="text"
                        value={form.location.accessNotes}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            location: { ...form.location, accessNotes: e.target.value },
                          })
                        }
                        placeholder="Gate location, special instructions..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Service Info Section (create only) */}
              {!editingClient && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Dog className="w-4 h-4 text-teal-600" />
                    Service Info
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Number of Dogs <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, numberOfDogs: Math.max(1, form.numberOfDogs - 1) })}
                          className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100 bg-white"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={form.numberOfDogs}
                          onChange={(e) => setForm({ ...form, numberOfDogs: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-16 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, numberOfDogs: form.numberOfDogs + 1 })}
                          className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100 bg-white"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cleanup Frequency <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.frequency}
                        onChange={(e) => setForm({ ...form, frequency: e.target.value as Frequency })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                      >
                        {FREQUENCIES.map((freq) => (
                          <option key={freq.value} value={freq.value}>
                            {freq.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Billing Option
                      </label>
                      <select
                        value={form.billingOption}
                        onChange={(e) => setForm({ ...form, billingOption: e.target.value as "auto" | "manual" })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                      >
                        <option value="auto">Auto-charge (Recommended)</option>
                        <option value="manual">Send Invoice</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Billing Interval
                      </label>
                      <select
                        value={form.billingInterval}
                        onChange={(e) => setForm({ ...form, billingInterval: e.target.value as "per-service" | "monthly" })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                      >
                        <option value="per-service">Per Service</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Coupon Code
                      </label>
                      <input
                        type="text"
                        value={form.couponCode}
                        onChange={(e) => setForm({ ...form, couponCode: e.target.value })}
                        placeholder="Enter coupon code"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Referral Source <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.referralSource}
                        onChange={(e) => setForm({ ...form, referralSource: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                      >
                        <option value="">Select source...</option>
                        {REFERRAL_SOURCES.map((source) => (
                          <option key={source} value={source}>
                            {source}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2 space-y-3 pt-2">
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.initialCleanupRequired}
                          onChange={(e) => setForm({ ...form, initialCleanupRequired: e.target.checked })}
                          className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        Initial Cleanup Required
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.requestTosApproval}
                          onChange={(e) => setForm({ ...form, requestTosApproval: e.target.checked })}
                          className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        Request Terms of Service Approval
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.taxExempt}
                          onChange={(e) => setForm({ ...form, taxExempt: e.target.checked })}
                          className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        Tax exempt
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Dogs Section (create only - for detailed dog info) */}
              {!editingClient && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <Dog className="w-4 h-4 text-teal-600" />
                      Dog Details (Optional)
                    </h3>
                    <button
                      type="button"
                      onClick={addDog}
                      className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                    >
                      + Add Dog
                    </button>
                  </div>
                  <div className="space-y-3">
                    {form.dogs.map((dog, index) => (
                      <div key={index} className="flex gap-3 items-start p-3 bg-white rounded-lg border border-gray-200">
                        <div className="flex-1 grid grid-cols-3 gap-3">
                          <input
                            type="text"
                            value={dog.name}
                            onChange={(e) => updateDog(index, "name", e.target.value)}
                            placeholder="Dog name"
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                          />
                          <input
                            type="text"
                            value={dog.breed}
                            onChange={(e) => updateDog(index, "breed", e.target.value)}
                            placeholder="Breed"
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                          />
                          <select
                            value={dog.size}
                            onChange={(e) => updateDog(index, "size", e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                          >
                            <option value="">Size</option>
                            <option value="SMALL">Small</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LARGE">Large</option>
                            <option value="XLARGE">X-Large</option>
                          </select>
                        </div>
                        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={dog.isSafe}
                            onChange={(e) => updateDog(index, "isSafe", e.target.checked)}
                            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          />
                          Safe
                        </label>
                        {form.dogs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeDog(index)}
                            className="p-2 text-gray-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes Section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Internal Notes</h3>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                  placeholder="Notes about this client (not visible to client)..."
                />
              </div>

              {/* Info Box (create only) */}
              {!editingClient && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">What happens next?</p>
                      <ul className="list-disc list-inside space-y-1 text-blue-700">
                        <li>Client profile will be created with the information provided</li>
                        <li>A subscription will be set up based on the frequency selected</li>
                        {form.requestTosApproval && <li>Terms of Service approval request will be sent</li>}
                        {form.initialCleanupRequired && <li>An initial cleanup job will be scheduled</li>}
                        <li>You can add payment methods and schedule services from the client profile</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.firstName || !form.lastName || (!editingClient && !form.email)}
                  className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium"
                >
                  {saving ? "Saving..." : editingClient ? "Save Changes" : "Create Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
