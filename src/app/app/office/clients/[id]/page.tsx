"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Dog,
  Calendar,
  DollarSign,
  Clock,
  Edit,
  CreditCard,
  CheckCircle,
  Pause,
  Ban,
  AlertTriangle,
  Building,
  Tag,
  FileText,
  Briefcase,
  Shield,
  ShieldAlert,
  Key,
  Plus,
} from "lucide-react";
import type { ClientStatus, Frequency } from "@/lib/supabase/types";

interface Location {
  id: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zipCode: string;
  fullAddress: string;
  gateCode: string | null;
  gateLocation: string | null;
  accessNotes: string | null;
  lotSize: string | null;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
}

interface DogInfo {
  id: string;
  name: string;
  breed: string | null;
  size: string | null;
  isSafe: boolean;
  safetyNotes: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Subscription {
  id: string;
  status: string;
  frequency: Frequency;
  pricePerVisitCents: number;
  nextServiceDate: string | null;
  serviceDay: string | null;
  assignedTechId: string | null;
  createdAt: string;
  canceledAt: string | null;
  cancelReason: string | null;
}

interface Job {
  id: string;
  status: string;
  scheduledDate: string;
  completedAt: string | null;
  skippedAt: string | null;
  skipReason: string | null;
  notes: string | null;
  techNotes: string | null;
  createdAt: string;
}

interface Payment {
  id: string;
  amountCents: number;
  status: string;
  paymentType: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  secondaryPhone: string | null;
  clientType: "RESIDENTIAL" | "COMMERCIAL";
  status: ClientStatus;
  accountCreditCents: number;
  tags: string[];
  notes: string | null;
  referralSource: string | null;
  hasStripeCustomer: boolean;
  notificationPreferences: { email?: boolean; sms?: boolean } | null;
  createdAt: string;
  updatedAt: string;
  locations: Location[];
  dogs: DogInfo[];
  subscriptions: Subscription[];
  assignedTech: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
  } | null;
  recentJobs: Job[];
  recentPayments: Payment[];
}

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

function getJobStatusColor(status: string) {
  switch (status) {
    case "COMPLETED":
      return "text-green-700 bg-green-100";
    case "SKIPPED":
      return "text-yellow-700 bg-yellow-100";
    case "SCHEDULED":
      return "text-blue-700 bg-blue-100";
    case "IN_PROGRESS":
      return "text-purple-700 bg-purple-100";
    default:
      return "text-gray-700 bg-gray-100";
  }
}

function getPaymentStatusColor(status: string) {
  switch (status) {
    case "PAID":
      return "text-green-700 bg-green-100";
    case "PENDING":
      return "text-yellow-700 bg-yellow-100";
    case "FAILED":
      return "text-red-700 bg-red-100";
    case "OPEN":
      return "text-blue-700 bg-blue-100";
    case "DRAFT":
      return "text-gray-700 bg-gray-100";
    default:
      return "text-gray-700 bg-gray-100";
  }
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatFrequency(freq: Frequency) {
  const labels: Record<Frequency, string> = {
    WEEKLY: "Weekly",
    BIWEEKLY: "Bi-weekly",
    MONTHLY: "Monthly",
    ONETIME: "One-time",
  };
  return labels[freq] || freq;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ClientDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClient() {
      try {
        const res = await fetch(`/api/admin/clients/${id}`);
        const data = await res.json();

        if (res.ok) {
          setClient(data.client);
        } else {
          setError(data.error || "Failed to load client");
        }
      } catch (err) {
        console.error("Error fetching client:", err);
        setError("Failed to load client");
      } finally {
        setLoading(false);
      }
    }

    fetchClient();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="space-y-4">
        <Link
          href="/app/office/clients"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </Link>
        <div className="bg-red-50 text-red-700 p-6 rounded-lg text-center">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <p>{error || "Client not found"}</p>
        </div>
      </div>
    );
  }

  const activeSubscription = client.subscriptions.find((s) => s.status === "ACTIVE");
  const activeDogs = client.dogs.filter((d) => d.isActive);
  const activeLocations = client.locations.filter((l) => l.isActive);
  const primaryLocation = activeLocations.find((l) => l.isPrimary) || activeLocations[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/app/office/clients"
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-teal-600 rounded-full flex items-center justify-center text-white text-xl font-medium">
              {client.firstName?.[0] || "?"}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{client.fullName}</h1>
                <span
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(client.status)}`}
                >
                  {getStatusIcon(client.status)}
                  {client.status}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  {client.clientType === "COMMERCIAL" ? (
                    <Building className="w-4 h-4" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                  {client.clientType}
                </span>
                {client.companyName && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-4 h-4" />
                    {client.companyName}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Client since {formatDate(client.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <Link
          href={`/app/office/clients?edit=${client.id}`}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
        >
          <Edit className="w-4 h-4" />
          Edit Client
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-gray-400" />
              Contact Information
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {client.email && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Mail className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <a href={`mailto:${client.email}`} className="text-teal-600 hover:underline">
                      {client.email}
                    </a>
                  </div>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Phone className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <a href={`tel:${client.phone}`} className="text-teal-600 hover:underline">
                      {client.phone}
                    </a>
                  </div>
                </div>
              )}
              {client.secondaryPhone && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Phone className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Secondary Phone</p>
                    <a href={`tel:${client.secondaryPhone}`} className="text-teal-600 hover:underline">
                      {client.secondaryPhone}
                    </a>
                  </div>
                </div>
              )}
              {client.referralSource && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Referral Source</p>
                    <p className="text-gray-900">{client.referralSource}</p>
                  </div>
                </div>
              )}
            </div>
            {client.tags.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  Tags
                </p>
                <div className="flex flex-wrap gap-2">
                  {client.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-lg"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Locations */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-gray-400" />
                Locations ({activeLocations.length})
              </h2>
              <button className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1">
                <Plus className="w-4 h-4" />
                Add Location
              </button>
            </div>
            {activeLocations.length === 0 ? (
              <p className="text-gray-500 text-sm">No locations added</p>
            ) : (
              <div className="space-y-4">
                {activeLocations.map((location) => (
                  <div
                    key={location.id}
                    className={`p-4 rounded-lg border ${location.isPrimary ? "border-teal-200 bg-teal-50" : "border-gray-100 bg-gray-50"}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{location.addressLine1}</p>
                          {location.isPrimary && (
                            <span className="text-xs px-2 py-0.5 bg-teal-600 text-white rounded">
                              Primary
                            </span>
                          )}
                        </div>
                        {location.addressLine2 && (
                          <p className="text-gray-600">{location.addressLine2}</p>
                        )}
                        <p className="text-gray-600">
                          {location.city}, {location.state} {location.zipCode}
                        </p>
                      </div>
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded">
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                    {(location.gateCode || location.accessNotes) && (
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                        {location.gateCode && (
                          <p className="text-sm text-gray-600 flex items-center gap-2">
                            <Key className="w-4 h-4 text-gray-400" />
                            Gate Code: <span className="font-mono font-medium">{location.gateCode}</span>
                          </p>
                        )}
                        {location.accessNotes && (
                          <p className="text-sm text-gray-600">{location.accessNotes}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dogs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Dog className="w-5 h-5 text-gray-400" />
                Dogs ({activeDogs.length})
              </h2>
              <button className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1">
                <Plus className="w-4 h-4" />
                Add Dog
              </button>
            </div>
            {activeDogs.length === 0 ? (
              <p className="text-gray-500 text-sm">No dogs added</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {activeDogs.map((dog) => (
                  <div key={dog.id} className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                          <Dog className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{dog.name}</p>
                          <p className="text-sm text-gray-500">
                            {[dog.breed, dog.size].filter(Boolean).join(" • ") || "No details"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {dog.isSafe ? (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <Shield className="w-4 h-4" />
                            Safe
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-red-600">
                            <ShieldAlert className="w-4 h-4" />
                            Caution
                          </span>
                        )}
                      </div>
                    </div>
                    {dog.safetyNotes && (
                      <p className="mt-2 text-sm text-gray-600 bg-white p-2 rounded">
                        {dog.safetyNotes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Jobs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              Recent Jobs
            </h2>
            {client.recentJobs.length === 0 ? (
              <p className="text-gray-500 text-sm">No jobs yet</p>
            ) : (
              <div className="space-y-2">
                {client.recentJobs.slice(0, 10).map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`px-2 py-1 rounded text-xs font-medium ${getJobStatusColor(job.status)}`}
                      >
                        {job.status}
                      </div>
                      <div>
                        <p className="text-sm text-gray-900">
                          {formatDate(job.scheduledDate)}
                        </p>
                        {job.notes && (
                          <p className="text-xs text-gray-500 truncate max-w-[200px]">
                            {job.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    {job.completedAt && (
                      <p className="text-xs text-gray-500">
                        Completed {formatDateTime(job.completedAt)}
                      </p>
                    )}
                    {job.skippedAt && (
                      <p className="text-xs text-yellow-600">
                        Skipped: {job.skipReason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Payments */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gray-400" />
              Recent Invoices & Payments
            </h2>
            {client.recentPayments.length === 0 ? (
              <p className="text-gray-500 text-sm">No payments yet</p>
            ) : (
              <div className="space-y-2">
                {client.recentPayments.slice(0, 10).map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`px-2 py-1 rounded text-xs font-medium ${getPaymentStatusColor(payment.status)}`}
                      >
                        {payment.status}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(payment.amountCents)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {payment.invoiceNumber || payment.paymentType}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      {payment.paidAt ? (
                        <p className="text-green-600">Paid {formatDate(payment.paidAt)}</p>
                      ) : payment.dueDate ? (
                        <p>Due {formatDate(payment.dueDate)}</p>
                      ) : (
                        <p>{formatDate(payment.createdAt)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Subscription */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" />
              Subscription
            </h2>
            {activeSubscription ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Frequency</span>
                  <span className="font-medium text-gray-900">
                    {formatFrequency(activeSubscription.frequency)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Rate</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(activeSubscription.pricePerVisitCents)}/visit
                  </span>
                </div>
                {activeSubscription.serviceDay && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Service Day</span>
                    <span className="font-medium text-gray-900 capitalize">
                      {activeSubscription.serviceDay.toLowerCase()}
                    </span>
                  </div>
                )}
                {activeSubscription.nextServiceDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Next Service</span>
                    <span className="font-medium text-teal-600">
                      {formatDate(activeSubscription.nextServiceDate)}
                    </span>
                  </div>
                )}
                {client.assignedTech && (
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">Assigned Technician</p>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-medium">
                        {client.assignedTech.firstName?.[0]}
                      </div>
                      <span className="text-gray-900">{client.assignedTech.fullName}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 text-sm mb-3">No active subscription</p>
                <button className="text-sm text-teal-600 hover:text-teal-700">
                  + Create Subscription
                </button>
              </div>
            )}
          </div>

          {/* Account Balance */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-gray-400" />
              Account
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Account Credit</span>
                <span
                  className={`font-medium ${client.accountCreditCents > 0 ? "text-green-600" : "text-gray-900"}`}
                >
                  {formatCurrency(client.accountCreditCents)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Payment Method</span>
                <span className="font-medium text-gray-900">
                  {client.hasStripeCustomer ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CreditCard className="w-4 h-4" />
                      On file
                    </span>
                  ) : (
                    <span className="text-gray-400">Not set up</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Primary Location Quick View */}
          {primaryLocation && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-gray-400" />
                Primary Location
              </h2>
              <div className="space-y-2">
                <p className="text-gray-900">{primaryLocation.addressLine1}</p>
                {primaryLocation.addressLine2 && (
                  <p className="text-gray-600">{primaryLocation.addressLine2}</p>
                )}
                <p className="text-gray-600">
                  {primaryLocation.city}, {primaryLocation.state} {primaryLocation.zipCode}
                </p>
                {primaryLocation.gateCode && (
                  <p className="text-sm text-gray-500 pt-2">
                    <span className="font-medium">Gate:</span>{" "}
                    <span className="font-mono">{primaryLocation.gateCode}</span>
                  </p>
                )}
              </div>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(primaryLocation.fullAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block w-full text-center py-2 text-sm text-teal-600 hover:text-teal-700 bg-teal-50 rounded-lg"
              >
                Open in Maps
              </a>
            </div>
          )}

          {/* Notes */}
          {client.notes && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                Internal Notes
              </h2>
              <p className="text-gray-600 text-sm whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}

          {/* Notification Preferences */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Email</span>
                <span
                  className={`text-sm ${client.notificationPreferences?.email ? "text-green-600" : "text-gray-400"}`}
                >
                  {client.notificationPreferences?.email ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">SMS</span>
                <span
                  className={`text-sm ${client.notificationPreferences?.sms ? "text-green-600" : "text-gray-400"}`}
                >
                  {client.notificationPreferences?.sms ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
