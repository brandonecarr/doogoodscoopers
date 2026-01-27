"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Clock,
  Edit,
  CreditCard,
  CheckCircle,
  Pause,
  Ban,
  AlertTriangle,
  ChevronDown,
  Plus,
  Eye,
  RotateCcw,
  Trash2,
  Send,
  RefreshCw,
  FileText,
  XCircle,
  X,
  Info,
} from "lucide-react";
import type { ClientStatus, Frequency } from "@/lib/supabase/types";

// Types - API returns camelCase format
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

interface ServicePlan {
  id: string;
  name: string;
  frequency: Frequency;
  description: string | null;
  is_active: boolean;
}

interface CrossSellItem {
  id: string;
  name: string;
  description: string;
  unit: string;
  pricePerUnit: number;
  type: string;
  taxable: boolean;
}

interface Subscription {
  id: string;
  status: string;
  frequency: Frequency;
  pricePerVisitCents: number;
  nextServiceDate: string | null;
  startDate?: string | null;
  endDate?: string | null;
  serviceDay?: string | null;
  preferredDay?: string | null;
  assignedTechId?: string | null;
  initialCleanupRequired?: boolean;
  initialCleanupCompleted?: boolean;
  createdAt: string;
  canceledAt?: string | null;
  cancelReason?: string | null;
  plan?: {
    id: string;
    name: string;
    frequency: Frequency;
    description: string | null;
  } | null;
  location?: {
    id: string;
    streetAddress: string;
    city: string;
  } | null;
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

interface Contact {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string | null;
  email: string | null;
  homePhone: string | null;
  cellPhone: string | null;
  relationship: string | null;
  isPrimary: boolean;
  canAuthorize: boolean;
  receiveJobNotifications: boolean;
  receiveInvoicesEmail: boolean;
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
  recentJobs: Job[];
  recentPayments: Payment[];
  contacts: Contact[];
}

// Helper functions
function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatFrequency(freq: Frequency) {
  const labels: Record<Frequency, string> = {
    TWICE_WEEKLY: "Twice A Week",
    WEEKLY: "Once A Week",
    BIWEEKLY: "Every Two Weeks",
    MONTHLY: "Monthly",
    ONETIME: "One-time",
  };
  return labels[freq] || freq;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function getStatusBadge(status: string) {
  const colors: Record<string, string> = {
    ACTIVE: "text-green-700 bg-green-100",
    PAUSED: "text-yellow-700 bg-yellow-100",
    CANCELED: "text-red-700 bg-red-100",
    DELINQUENT: "text-orange-700 bg-orange-100",
    PAID: "text-green-700 bg-green-100",
    SUCCEEDED: "text-green-700 bg-green-100",
    PENDING: "text-yellow-700 bg-yellow-100",
    OPEN: "text-blue-700 bg-blue-100",
    DRAFT: "text-gray-700 bg-gray-100",
    FAILED: "text-red-700 bg-red-100",
    DISPATCHED: "text-orange-700 bg-orange-100",
    COMPLETED: "text-green-700 bg-green-100",
    SCHEDULED: "text-blue-700 bg-blue-100",
  };
  return colors[status] || "text-gray-700 bg-gray-100";
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ClientDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [billingTab, setBillingTab] = useState<"subscriptions" | "invoices" | "payments" | "cards" | "giftcerts">("subscriptions");
  const [scheduleTab, setScheduleTab] = useState<"recurring" | "initial" | "latest">("recurring");
  const [notesTab, setNotesTab] = useState<"office" | "totech" | "fromtech" | "fromclient">("office");
  const [activeDogTab, setActiveDogTab] = useState(0);
  const [activeContactTab, setActiveContactTab] = useState<string>("primary");
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    homePhone: "",
    cellPhone: "",
    receiveJobNotifications: false,
    receiveInvoicesEmail: false,
  });
  const [savingContact, setSavingContact] = useState(false);

  // Subscription modal state
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionForm, setSubscriptionForm] = useState({
    servicePlan: "",
    startDate: "",
    endDate: "",
    billingOption: "prepaid-fixed",
    billingInterval: "monthly",
    couponCode: "",
    initialCleanupRequired: false,
    // No Dogs mode fields
    service: "",
    pricePerUnit: "",
    serviceFrequency: "",
  });
  const [savingSubscription, setSavingSubscription] = useState(false);
  const [servicePlans, setServicePlans] = useState<ServicePlan[]>([]);
  const [loadingServicePlans, setLoadingServicePlans] = useState(false);
  const [cleanupFrequencies, setCleanupFrequencies] = useState<string[]>([]);
  const [residentialCrossSells, setResidentialCrossSells] = useState<CrossSellItem[]>([]);

  const resetSubscriptionForm = () => {
    setSubscriptionForm({
      servicePlan: "",
      startDate: "",
      endDate: "",
      billingOption: "prepaid-fixed",
      billingInterval: "monthly",
      couponCode: "",
      initialCleanupRequired: false,
      service: "",
      pricePerUnit: "",
      serviceFrequency: "",
    });
  };

  // Frequency labels for display
  const FREQUENCY_LABELS: Record<string, string> = {
    SEVEN_TIMES_A_WEEK: "7x Week",
    SIX_TIMES_A_WEEK: "6x Week",
    FIVE_TIMES_A_WEEK: "5x Week",
    FOUR_TIMES_A_WEEK: "4x Week",
    THREE_TIMES_A_WEEK: "3x Week",
    TWO_TIMES_A_WEEK: "2x Week",
    ONCE_A_WEEK: "1x Week",
    BI_WEEKLY: "Bi-Weekly",
    TWICE_PER_MONTH: "2x Month",
    EVERY_THREE_WEEKS: "Every 3 Weeks",
    EVERY_FOUR_WEEKS: "Every 4 Weeks",
    ONCE_A_MONTH: "1x Month",
    ONE_TIME: "One-Time",
  };

  // Generate dynamic service plan options based on dog count and enabled frequencies
  const generateServicePlanOptions = () => {
    const activeDogCount = client?.dogs?.filter((d) => d.isActive).length || 0;
    const options: { value: string; label: string }[] = [];

    // Generate options based on dog count and enabled frequencies
    if (activeDogCount > 0 && cleanupFrequencies.length > 0) {
      cleanupFrequencies.forEach((freq) => {
        const freqLabel = FREQUENCY_LABELS[freq] || freq;
        options.push({
          value: `${activeDogCount}_DOGS_${freq}`,
          label: `${activeDogCount} Dog${activeDogCount > 1 ? "s" : ""} ${freqLabel}`,
        });
      });
    }

    // Add "No Dogs" option at the bottom
    options.push({ value: "NO_DOGS", label: "No Dogs" });

    return options;
  };

  const fetchServicePlans = async () => {
    setLoadingServicePlans(true);
    try {
      // Fetch both service plans and onboarding settings in parallel
      const [plansRes, settingsRes] = await Promise.all([
        fetch("/api/admin/service-plans"),
        fetch("/api/admin/onboarding-settings"),
      ]);

      if (plansRes.ok) {
        const data = await plansRes.json();
        setServicePlans(data.plans?.filter((p: ServicePlan) => p.is_active) || []);
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const frequencies = settingsData.settings?.onboarding?.cleanupFrequencies || [];
        setCleanupFrequencies(frequencies);
        const crossSells = settingsData.settings?.residentialCrossSells?.items || [];
        setResidentialCrossSells(crossSells);
      }
    } catch (err) {
      console.error("Error fetching service plans:", err);
    } finally {
      setLoadingServicePlans(false);
    }
  };

  const handleSaveSubscription = async () => {
    if (!subscriptionForm.servicePlan || !subscriptionForm.startDate) {
      return;
    }

    // Validate No Dogs mode fields
    if (subscriptionForm.servicePlan === "NO_DOGS") {
      if (!subscriptionForm.service || !subscriptionForm.pricePerUnit || !subscriptionForm.serviceFrequency) {
        return;
      }
    }

    setSavingSubscription(true);
    try {
      // Build request body based on mode
      const isNoDogs = subscriptionForm.servicePlan === "NO_DOGS";

      // Parse the service plan value for dog-based subscriptions
      // Format: "{dogCount}_DOGS_{frequency}" e.g., "2_DOGS_ONCE_A_WEEK"
      let frequency = subscriptionForm.billingInterval === "weekly" ? "WEEKLY" :
                      subscriptionForm.billingInterval === "biweekly" ? "BIWEEKLY" : "MONTHLY";
      let dogCount = 0;

      if (!isNoDogs && subscriptionForm.servicePlan) {
        const parts = subscriptionForm.servicePlan.split("_DOGS_");
        if (parts.length === 2) {
          dogCount = parseInt(parts[0], 10);
          frequency = parts[1]; // e.g., "ONCE_A_WEEK", "BI_WEEKLY"
        }
      }

      const requestBody = isNoDogs
        ? {
            // No Dogs mode - custom service
            isNoDogs: true,
            service: subscriptionForm.service,
            priceOverrideCents: Math.round(parseFloat(subscriptionForm.pricePerUnit) * 100),
            frequency: subscriptionForm.serviceFrequency,
            startDate: subscriptionForm.startDate,
            endDate: subscriptionForm.endDate || null,
            billingOption: subscriptionForm.billingOption,
            billingInterval: subscriptionForm.billingInterval,
            couponCode: subscriptionForm.couponCode || null,
            initialCleanupRequired: subscriptionForm.initialCleanupRequired,
          }
        : {
            // Dog-based subscription
            servicePlanValue: subscriptionForm.servicePlan,
            dogCount,
            frequency,
            startDate: subscriptionForm.startDate,
            endDate: subscriptionForm.endDate || null,
            billingOption: subscriptionForm.billingOption,
            billingInterval: subscriptionForm.billingInterval,
            couponCode: subscriptionForm.couponCode || null,
            initialCleanupRequired: subscriptionForm.initialCleanupRequired,
          };

      const res = await fetch(`/api/admin/clients/${id}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (res.ok) {
        const data = await res.json();
        // Update client with new subscription
        if (client) {
          setClient({
            ...client,
            subscriptions: [data.subscription, ...(client.subscriptions || [])],
          });
        }
        setShowSubscriptionModal(false);
        resetSubscriptionForm();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create subscription");
      }
    } catch (err) {
      console.error("Error creating subscription:", err);
      alert("Failed to create subscription");
    } finally {
      setSavingSubscription(false);
    }
  };

  // Fetch service plans when modal opens
  useEffect(() => {
    if (showSubscriptionModal && servicePlans.length === 0) {
      fetchServicePlans();
    }
  }, [showSubscriptionModal]);

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

  const resetContactForm = () => {
    setContactForm({
      firstName: "",
      middleName: "",
      lastName: "",
      email: "",
      homePhone: "",
      cellPhone: "",
      receiveJobNotifications: false,
      receiveInvoicesEmail: false,
    });
  };

  const handleSaveContact = async () => {
    if (!contactForm.firstName || !contactForm.lastName) {
      return;
    }

    setSavingContact(true);
    try {
      const res = await fetch(`/api/admin/clients/${id}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });

      if (res.ok) {
        const data = await res.json();
        // Update client with new contact
        if (client) {
          setClient({
            ...client,
            contacts: [...(client.contacts || []), data.contact],
          });
        }
        // Switch to the new contact's tab
        setActiveContactTab(data.contact.id);
        setShowContactModal(false);
        resetContactForm();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save contact");
      }
    } catch (err) {
      console.error("Error saving contact:", err);
      alert("Failed to save contact");
    } finally {
      setSavingContact(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm("Are you sure you want to remove this contact?")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/clients/${id}/contacts?contactId=${contactId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // Update client by removing the contact
        if (client) {
          setClient({
            ...client,
            contacts: client.contacts.filter((c) => c.id !== contactId),
          });
        }
        // Switch to primary tab if the deleted contact was active
        if (activeContactTab === contactId) {
          setActiveContactTab("primary");
        }
      } else {
        const data = await res.json();
        alert(data.error || "Failed to remove contact");
      }
    } catch (err) {
      console.error("Error deleting contact:", err);
      alert("Failed to remove contact");
    }
  };

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
          Back
        </Link>
        <div className="bg-red-50 text-red-700 p-6 rounded-lg text-center">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <p>{error || "Client not found"}</p>
        </div>
      </div>
    );
  }

  const fullName = client.fullName || "Unknown";
  const initials = client.firstName?.[0]?.toUpperCase() || "?";
  const activeDogs = client.dogs?.filter((d) => d.isActive) || [];
  const activeLocations = client.locations?.filter((l) => l.isActive) || [];
  const primaryLocation = activeLocations.find((l) => l.isPrimary) || activeLocations[0];
  const activeSubscriptions = client.subscriptions?.filter((s) => s.status === "ACTIVE") || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-900">Client Info</h1>
        </div>
        <Link
          href="/app/office/clients"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      {/* Client Header Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-teal-600 rounded-full flex items-center justify-center text-white text-xl font-medium">
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{fullName}</h2>
              <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded ${client.clientType === "RESIDENTIAL" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                {client.clientType}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Stats */}
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <p className="text-gray-500">Gift Cert.</p>
                <p className="font-semibold text-gray-900">$0.00</p>
              </div>
              <div className="text-center border-l border-gray-200 pl-6">
                <p className="text-gray-500">Open</p>
                <p className="font-semibold text-gray-900">$0.00</p>
              </div>
              <div className="text-center border-l border-gray-200 pl-6">
                <p className="text-gray-500">Overdue</p>
                <p className="font-semibold text-red-600">$0.00</p>
              </div>
            </div>

            {/* Actions Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                ACTIONS
                <ChevronDown className="w-4 h-4" />
              </button>
              {showActions && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20">
                  <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3">
                    <Mail className="w-4 h-4 text-gray-400" />
                    Resend Login Info
                  </button>
                  <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3">
                    <RefreshCw className="w-4 h-4 text-gray-400" />
                    Convert to {client.clientType === "RESIDENTIAL" ? "Commercial" : "Residential"} Client
                  </button>
                  <button className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3">
                    <XCircle className="w-4 h-4" />
                    Cancel All Active Subscriptions
                  </button>
                  <button className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3">
                    <Ban className="w-4 h-4" />
                    Disable Client
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Contact Info</h3>
          <button
            onClick={() => setShowContactModal(true)}
            className="text-sm font-medium text-teal-600 hover:text-teal-700"
          >
            ADD NEW CONTACT
          </button>
        </div>
        {/* Contact Tabs */}
        <div className="border-b border-gray-100">
          <div className="flex gap-6 px-4">
            <button
              onClick={() => setActiveContactTab("primary")}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeContactTab === "primary"
                  ? "text-teal-600 border-teal-600"
                  : "text-gray-500 border-transparent hover:text-gray-700"
              }`}
            >
              PRIMARY
            </button>
            {client.contacts?.map((contact, index) => (
              <button
                key={contact.id}
                onClick={() => setActiveContactTab(contact.id)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeContactTab === contact.id
                    ? "text-teal-600 border-teal-600"
                    : "text-gray-500 border-transparent hover:text-gray-700"
                }`}
              >
                {contact.firstName?.toUpperCase() || `CONTACT ${index + 2}`}
              </button>
            ))}
          </div>
        </div>
        {/* Contact Content */}
        <div className="p-4">
          {activeContactTab === "primary" && (
            <>
              <div className="grid grid-cols-2 gap-x-8 gap-y-0">
                <div className="flex gap-4 py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500 min-w-[140px]">First name</span>
                  <span className="text-sm font-semibold text-gray-900">{client.firstName || "No Data"}</span>
                </div>
                <div className="flex gap-4 py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500 min-w-[140px]">Home Phone Number</span>
                  <span className="text-sm font-semibold text-gray-900">{client.phone || "No Data"}</span>
                </div>
                <div className="flex gap-4 py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500 min-w-[140px]">Middle Name</span>
                  <span className="text-sm font-semibold text-gray-400">No Data</span>
                </div>
                <div className="flex gap-4 py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500 min-w-[140px]">Cell Phone Number</span>
                  <span className="text-sm font-semibold text-gray-900">{client.secondaryPhone || "No Data"}</span>
                </div>
                <div className="flex gap-4 py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500 min-w-[140px]">Last name</span>
                  <span className="text-sm font-semibold text-gray-900">{client.lastName || "No Data"}</span>
                </div>
                <div className="flex gap-4 py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500 min-w-[140px]">Tax Exempt</span>
                  <span className="text-sm font-semibold text-gray-900">No</span>
                </div>
                <div className="flex gap-4 py-2">
                  <span className="text-sm text-gray-500 min-w-[140px]">Email</span>
                  <span className="text-sm font-semibold text-gray-900">{client.email || "No Data"}</span>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button className="text-sm font-medium text-red-600 hover:text-red-700">REMOVE</button>
                <button className="text-sm font-medium text-teal-600 hover:text-teal-700">EDIT</button>
              </div>
            </>
          )}
          {client.contacts?.map((contact) => (
            activeContactTab === contact.id && (
              <div key={contact.id}>
                <div className="grid grid-cols-2 gap-x-8 gap-y-0">
                  <div className="flex gap-4 py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500 min-w-[140px]">First name</span>
                    <span className="text-sm font-semibold text-gray-900">{contact.firstName || "No Data"}</span>
                  </div>
                  <div className="flex gap-4 py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500 min-w-[140px]">Home Phone Number</span>
                    <span className="text-sm font-semibold text-gray-900">{contact.homePhone || "No Data"}</span>
                  </div>
                  <div className="flex gap-4 py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500 min-w-[140px]">Middle Name</span>
                    <span className={`text-sm font-semibold ${contact.middleName ? "text-gray-900" : "text-gray-400"}`}>
                      {contact.middleName || "No Data"}
                    </span>
                  </div>
                  <div className="flex gap-4 py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500 min-w-[140px]">Cell Phone Number</span>
                    <span className="text-sm font-semibold text-gray-900">{contact.cellPhone || "No Data"}</span>
                  </div>
                  <div className="flex gap-4 py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500 min-w-[140px]">Last name</span>
                    <span className="text-sm font-semibold text-gray-900">{contact.lastName || "No Data"}</span>
                  </div>
                  <div className="flex gap-4 py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500 min-w-[140px]">Tax Exempt</span>
                    <span className="text-sm font-semibold text-gray-900">No</span>
                  </div>
                  <div className="flex gap-4 py-2">
                    <span className="text-sm text-gray-500 min-w-[140px]">Email</span>
                    <span className="text-sm font-semibold text-gray-900">{contact.email || "No Data"}</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => handleDeleteContact(contact.id)}
                    className="text-sm font-medium text-red-600 hover:text-red-700"
                  >
                    REMOVE
                  </button>
                  <button className="text-sm font-medium text-teal-600 hover:text-teal-700">EDIT</button>
                </div>
              </div>
            )
          ))}
        </div>
      </div>

      {/* Location */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Location</h3>
        </div>
        <div className="p-4">
          {primaryLocation ? (
            <div className="grid grid-cols-2 gap-x-8 gap-y-0">
              <div className="flex gap-4 py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500 min-w-[140px]">Home Address</span>
                <span className="text-sm font-semibold text-gray-900">{primaryLocation.addressLine1}</span>
              </div>
              <div className="flex gap-4 py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500 min-w-[140px]">Zip Code</span>
                <span className="text-sm font-semibold text-gray-900">{primaryLocation.zipCode}</span>
              </div>
              <div className="flex gap-4 py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500 min-w-[140px]">City</span>
                <span className="text-sm font-semibold text-gray-900">{primaryLocation.city}</span>
              </div>
              <div className="flex gap-4 py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500 min-w-[140px]">Country</span>
                <span className="text-sm font-semibold text-gray-900">United States</span>
              </div>
              <div className="flex gap-4 py-2">
                <span className="text-sm text-gray-500 min-w-[140px]">State</span>
                <span className="text-sm font-semibold text-gray-900">{primaryLocation.state}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No location data</p>
          )}
          <div className="flex justify-end mt-4">
            <button className="text-sm font-medium text-teal-600 hover:text-teal-700">EDIT</button>
          </div>
        </div>
      </div>

      {/* Billing */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Billing</h3>
        </div>
        <div className="border-b border-gray-100">
          <div className="flex gap-6 px-4">
            {[
              { key: "subscriptions", label: "SUBSCRIPTIONS" },
              { key: "invoices", label: "INVOICES" },
              { key: "payments", label: "PAYMENTS" },
              { key: "cards", label: "CREDIT CARDS" },
              { key: "giftcerts", label: "GIFT CERTIFICATES" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setBillingTab(tab.key as typeof billingTab)}
                className={`py-3 text-sm font-medium border-b-2 -mb-px ${billingTab === tab.key ? "text-teal-600 border-teal-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4">
          {billingTab === "subscriptions" && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="pb-3 font-medium">Plan</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Frequency</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Start Date</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {client.subscriptions?.length > 0 ? (
                      client.subscriptions.map((sub) => (
                        <tr key={sub.id}>
                          <td className="py-3 font-semibold text-teal-600">
                            {sub.plan?.name || formatFrequency(sub.frequency)}
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(sub.status)}`}>
                              {sub.status}
                            </span>
                          </td>
                          <td className="py-3 font-semibold">{formatFrequency(sub.frequency)}</td>
                          <td className="py-3 font-semibold">{formatCurrency(sub.pricePerVisitCents)}/visit</td>
                          <td className="py-3 font-semibold">
                            {sub.startDate ? formatDate(sub.startDate) : formatDate(sub.createdAt)}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <button className="p-1 text-gray-400 hover:text-teal-600"><Eye className="w-4 h-4" /></button>
                              <button className="p-1 text-gray-400 hover:text-teal-600"><RotateCcw className="w-4 h-4" /></button>
                              <button className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-400">No subscriptions</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowSubscriptionModal(true)}
                  className="text-sm font-medium text-teal-600 hover:text-teal-700"
                >
                  CREATE NEW SUBSCRIPTION
                </button>
              </div>
            </>
          )}
          {billingTab === "invoices" && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="pb-3 font-medium">Date Created</th>
                      <th className="pb-3 font-medium">Invoice #</th>
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium">Payment Method</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Invoice Total</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {client.recentPayments?.length > 0 ? (
                      client.recentPayments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="py-3 font-semibold">{formatDate(payment.createdAt)}</td>
                          <td className="py-3 font-semibold text-teal-600">{payment.invoiceNumber || "N/A"}</td>
                          <td className="py-3 font-semibold">{payment.paymentType}</td>
                          <td className="py-3 font-semibold">Credit Card</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(payment.status)}`}>
                              {payment.status}
                            </span>
                          </td>
                          <td className="py-3 font-semibold">{formatCurrency(payment.amountCents)}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <button className="text-teal-600 hover:text-teal-700 text-sm">View</button>
                              <button className="text-gray-400 hover:text-gray-600 text-sm">More...</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-400">No invoices</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-4">
                <button className="text-sm font-medium text-teal-600 hover:text-teal-700">CREATE INVOICE DRAFT</button>
              </div>
            </>
          )}
          {billingTab === "payments" && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="pb-3 font-medium">Date Created</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Tip</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Payment Method</th>
                      <th className="pb-3 font-medium">Description</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {client.recentPayments?.length > 0 ? (
                      client.recentPayments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="py-3 font-semibold">{formatDate(payment.createdAt)}</td>
                          <td className="py-3 font-semibold">{formatCurrency(payment.amountCents)}</td>
                          <td className="py-3 font-semibold">$0.00</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(payment.status)}`}>
                              {payment.status}
                            </span>
                          </td>
                          <td className="py-3 font-semibold">Credit Card</td>
                          <td className="py-3 font-semibold text-gray-500">Payment for invoice(s) {payment.invoiceNumber}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <button className="p-1 text-gray-400 hover:text-teal-600"><Eye className="w-4 h-4" /></button>
                              <button className="p-1 text-gray-400 hover:text-gray-600"><RotateCcw className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-400">No payments</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-4">
                <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                  <CreditCard className="w-4 h-4" />
                  RECEIVE CHECK PAYMENT
                </button>
              </div>
            </>
          )}
          {billingTab === "cards" && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="pb-3 font-medium">Credit Card Number</th>
                      <th className="pb-3 font-medium">Name on Card</th>
                      <th className="pb-3 font-medium">Expiration Date</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.hasStripeCustomer ? (
                      <tr>
                        <td className="py-3 font-semibold">
                          <span className="font-bold text-blue-600">VISA</span>
                          <span className="ml-2">xxxx xxxx (Default)</span>
                        </td>
                        <td className="py-3 font-semibold">{fullName}</td>
                        <td className="py-3 font-semibold">XX/XXXX</td>
                        <td className="py-3">
                          <div className="flex items-center gap-4">
                            <button className="text-sm text-gray-500">Set Default</button>
                            <button className="text-sm text-red-600">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-gray-400">No credit cards on file</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-4 mt-4">
                <button className="text-sm font-medium text-teal-600 hover:text-teal-700">CREATE CARD LINK</button>
                <button className="text-sm font-medium text-teal-600 hover:text-teal-700">ADD CARD</button>
              </div>
            </>
          )}
          {billingTab === "giftcerts" && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Amount Used</th>
                      <th className="pb-3 font-medium">Expires</th>
                      <th className="pb-3 font-medium">Purchaser Name</th>
                      <th className="pb-3 font-medium">Reference Number</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">No data available</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-4">
                <button className="text-sm font-medium text-teal-600 hover:text-teal-700">CREATE GIFT CERTIFICATE</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cross-Sells */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Cross-Sells</h3>
        </div>
        <div className="p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Description</th>
                <th className="pb-3 font-medium">Unit</th>
                <th className="pb-3 font-medium">Price per Unit</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400">No data available</td>
              </tr>
            </tbody>
          </table>
          <div className="flex justify-end mt-4">
            <button className="text-sm font-medium text-teal-600 hover:text-teal-700">ADD NEW</button>
          </div>
        </div>
      </div>

      {/* Schedule */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <h3 className="font-semibold text-gray-900">Schedule</h3>
          {activeSubscriptions.map((sub, i) => (
            <span key={sub.id} className={`px-3 py-1 text-xs rounded ${i === 0 ? "bg-teal-600 text-white" : "bg-gray-200 text-gray-700"}`}>
              {sub.frequency}
            </span>
          ))}
        </div>
        <div className="border-b border-gray-100">
          <div className="flex gap-6 px-4">
            {[
              { key: "recurring", label: "RECURRING SERVICE" },
              { key: "initial", label: "INITIAL/ONE-TIME SERVICE" },
              { key: "latest", label: "LATEST SERVICES" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setScheduleTab(tab.key as typeof scheduleTab)}
                className={`py-3 text-sm font-medium border-b-2 -mb-px ${scheduleTab === tab.key ? "text-teal-600 border-teal-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4">
          {scheduleTab === "recurring" && (
            <div className="grid grid-cols-2 gap-x-8 gap-y-0">
              <div className="flex gap-4 py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500 min-w-[200px]">Cleanup Frequency</span>
                <span className="text-sm font-semibold text-gray-900">{activeSubscriptions[0] ? formatFrequency(activeSubscriptions[0].frequency) : "No Data"}</span>
              </div>
              <div className="flex gap-4 py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500 min-w-[200px]">Service Days</span>
                <span className="text-sm font-semibold text-gray-900">{activeSubscriptions[0]?.serviceDay || "No Data"}</span>
              </div>
              <div className="flex gap-4 py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500 min-w-[200px]">Regular Service Start Date</span>
                <span className="text-sm font-semibold text-gray-900">{activeSubscriptions[0]?.nextServiceDate ? formatDate(activeSubscriptions[0].nextServiceDate) : "No Data"}</span>
              </div>
              <div className="flex gap-4 py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500 min-w-[200px]">Next Recurring Cleanup Date</span>
                <span className="text-sm font-semibold text-gray-900">{activeSubscriptions[0]?.nextServiceDate ? formatDate(activeSubscriptions[0].nextServiceDate) : "No Data"}</span>
              </div>
              <div className="flex gap-4 py-2">
                <span className="text-sm text-gray-500 min-w-[200px]">Field Tech</span>
                <span className="text-sm font-semibold text-gray-900">Not Assigned</span>
              </div>
              <div className="flex gap-4 py-2">
                <span className="text-sm text-gray-500 min-w-[200px]">Estimated Time for Recurring Cleanup</span>
                <span className="text-sm font-semibold text-gray-900">30 min</span>
              </div>
            </div>
          )}
          {scheduleTab === "latest" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="pb-3 font-medium">Job ID</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Cleanup Assign To</th>
                    <th className="pb-3 font-medium">Schedule Date</th>
                    <th className="pb-3 font-medium">Service Name</th>
                    <th className="pb-3 font-medium">Spent Time</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {client.recentJobs?.length > 0 ? (
                    client.recentJobs.map((job) => (
                      <tr key={job.id}>
                        <td className="py-3 font-semibold text-teal-600">{job.id.substring(0, 8)}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(job.status)}`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="py-3 font-semibold">Not Assigned</td>
                        <td className="py-3 font-semibold">{formatDate(job.scheduledDate)}</td>
                        <td className="py-3 font-semibold">Regular Plan Cleanup</td>
                        <td className="py-3 font-semibold text-gray-400">No Data</td>
                        <td className="py-3">
                          <button className="p-1 text-gray-400 hover:text-teal-600"><Eye className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400">No jobs</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {scheduleTab === "initial" && (
            <div className="grid grid-cols-2 gap-x-8 gap-y-0">
              <div className="flex gap-4 py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500 min-w-[200px]">Initial Cleanup Date</span>
                <span className="text-sm font-semibold text-gray-900">{client.createdAt ? formatDate(client.createdAt) : "No Data"}</span>
              </div>
              <div />
              <div className="flex gap-4 py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500 min-w-[200px]">Initial Cleanup Assign To</span>
                <span className="text-sm font-semibold text-gray-900">Not Assigned</span>
              </div>
              <div />
              <div className="flex gap-4 py-2">
                <span className="text-sm text-gray-500 min-w-[200px]">Estimated Time for Initial Cleanup</span>
                <span className="text-sm font-semibold text-gray-900">90 min</span>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-4 mt-4">
            <button className="text-sm font-medium text-teal-600 hover:text-teal-700">ADD JOB</button>
            <button className="text-sm font-medium text-teal-600 hover:text-teal-700">ADD ONE-TIME ADD-ON SERVICE</button>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Notes</h3>
        </div>
        <div className="border-b border-gray-100">
          <div className="flex gap-6 px-4">
            {[
              { key: "office", label: "OFFICE NOTES" },
              { key: "totech", label: "TO TECH" },
              { key: "fromtech", label: "FROM TECH" },
              { key: "fromclient", label: "FROM CLIENT" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setNotesTab(tab.key as typeof notesTab)}
                className={`py-3 text-sm font-medium border-b-2 -mb-px ${notesTab === tab.key ? "text-teal-600 border-teal-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4">
          {notesTab === "office" && (
            <div className="text-center py-8 text-gray-400">
              {client.notes || "No data available"}
            </div>
          )}
          {notesTab === "fromclient" && (
            <div className="space-y-3">
              {client.referralSource && (
                <div className="flex gap-4 py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500 min-w-[180px]">How you heard about us</span>
                  <span className="text-sm font-semibold text-gray-900">{client.referralSource}</span>
                </div>
              )}
            </div>
          )}
          {(notesTab === "totech" || notesTab === "fromtech") && (
            <div className="text-center py-8 text-gray-400">No data available</div>
          )}
          <div className="flex justify-end mt-4">
            <button className="text-sm font-medium text-teal-600 hover:text-teal-700">CREATE NOTE</button>
          </div>
        </div>
      </div>

      {/* Dog Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Dog Info</h3>
          <button className="text-sm font-medium text-teal-600 hover:text-teal-700">ADD NEW</button>
        </div>
        {activeDogs.length > 0 && (
          <div className="border-b border-gray-100">
            <div className="flex gap-4 px-4">
              {activeDogs.map((dog, i) => (
                <button
                  key={dog.id}
                  onClick={() => setActiveDogTab(i)}
                  className={`py-3 text-sm font-medium border-b-2 -mb-px ${activeDogTab === i ? "text-teal-600 border-teal-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}
                >
                  DOG #{i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="p-4">
          {activeDogs.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-x-8 gap-y-0">
                <div className="flex gap-4 py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500 min-w-[200px]">Name</span>
                  <span className="text-sm font-semibold text-gray-900">{activeDogs[activeDogTab]?.name || "No Data"}</span>
                </div>
                <div className="flex gap-4 py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500 min-w-[200px]">Dangerous Dog</span>
                  <span className="text-sm font-semibold text-gray-900">{activeDogs[activeDogTab]?.isSafe === false ? "Yes" : "-"}</span>
                </div>
                <div className="flex gap-4 py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500 min-w-[200px]">Gender</span>
                  <span className="text-sm font-semibold text-gray-400">No Gender</span>
                </div>
                <div className="flex gap-4 py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500 min-w-[200px]">Breed</span>
                  <span className="text-sm font-semibold text-gray-900">{activeDogs[activeDogTab]?.breed || "No Data"}</span>
                </div>
                <div className="flex gap-4 py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500 min-w-[200px]">Birthdate</span>
                  <span className="text-sm font-semibold text-gray-400">No Birth Date</span>
                </div>
                <div className="flex gap-4 py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500 min-w-[200px]">Additional Comments about Dog</span>
                  <span className="text-sm font-semibold text-gray-900">{activeDogs[activeDogTab]?.safetyNotes || "No Additional Comment"}</span>
                </div>
                <div className="flex gap-4 py-2">
                  <span className="text-sm text-gray-500 min-w-[200px]">Dog Photo</span>
                  <span className="text-sm font-semibold text-gray-400">No data</span>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button className="text-sm font-medium text-red-600 hover:text-red-700">REMOVE</button>
                <button className="text-sm font-medium text-teal-600 hover:text-teal-700">EDIT</button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-400">No dogs added</div>
          )}
        </div>
      </div>

      {/* Yard Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Yard Info</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-x-8 gap-y-0">
            <div className="flex gap-4 py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500 min-w-[160px]">Gate Location</span>
              <span className="text-sm font-semibold text-gray-900">{primaryLocation?.gateLocation || "No Data"}</span>
            </div>
            <div className="flex gap-4 py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500 min-w-[160px]">Yard Size</span>
              <span className="text-sm font-semibold text-gray-900">{primaryLocation?.lotSize || "No Data"}</span>
            </div>
            <div className="flex gap-4 py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500 min-w-[160px]">Gate Code</span>
              <span className="text-sm font-semibold text-gray-900">{primaryLocation?.gateCode || "No Data"}</span>
            </div>
            <div className="flex gap-4 py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500 min-w-[160px]">Gated Community</span>
              <span className="text-sm font-semibold text-gray-400">No Data</span>
            </div>
            <div className="flex gap-4 py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500 min-w-[160px]">Areas To Clean</span>
              <span className="text-sm font-semibold text-gray-400">No data</span>
            </div>
            <div className="flex gap-4 py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500 min-w-[160px]">Yard Photo</span>
              <span className="text-sm font-semibold text-gray-400">No data</span>
            </div>
            <div className="flex gap-4 py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500 min-w-[160px]">Doggie Door</span>
              <span className="text-sm font-semibold text-gray-400">No Data</span>
            </div>
            <div className="flex gap-4 py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500 min-w-[160px]">Garbage Can Location</span>
              <span className="text-sm font-semibold text-gray-400">No Data</span>
            </div>
            <div className="flex gap-4 py-2 col-span-2">
              <span className="text-sm text-gray-500 min-w-[160px]">Additional Comments</span>
              <span className="text-sm font-semibold text-gray-900">{primaryLocation?.accessNotes || "No Data"}</span>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button className="text-sm font-medium text-teal-600 hover:text-teal-700">EDIT</button>
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Notification Preferences</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-x-8 gap-y-0">
            <div className="flex gap-4 py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500 min-w-[200px]">Cleanup Notification Type</span>
              <span className="text-sm font-semibold text-gray-400">No Cleanup Notification Type</span>
            </div>
            <div />
            <div className="flex gap-4 py-2">
              <span className="text-sm text-gray-500 min-w-[200px]">Cleanup Notification Method</span>
              <span className="text-sm font-semibold text-gray-900">
                {client.notificationPreferences?.sms ? "Text + " : ""}
                {client.notificationPreferences?.email ? "Email + " : ""}
                Web Portal
              </span>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button className="text-sm font-medium text-teal-600 hover:text-teal-700">EDIT</button>
          </div>
        </div>
      </div>

      {/* Net Terms */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Net Terms</h3>
        </div>
        <div className="p-4">
          <div className="flex gap-4 py-2">
            <span className="text-sm text-gray-500 min-w-[140px]">NET</span>
            <span className="text-sm font-semibold text-gray-900">Organization Default</span>
          </div>
          <div className="flex justify-end mt-4">
            <button className="text-sm font-medium text-teal-600 hover:text-teal-700">EDIT</button>
          </div>
        </div>
      </div>

      {/* Client Tax */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Client Tax</h3>
        </div>
        <div className="p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-3 font-medium">Tax Name</th>
                <th className="pb-3 font-medium">Service Percentage</th>
                <th className="pb-3 font-medium">Product Percentage</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2 font-semibold">SALES TAX TOTAL</td>
                <td className="py-2 font-semibold">0.000%</td>
                <td className="py-2 font-semibold">0.000%</td>
              </tr>
            </tbody>
          </table>
          <div className="flex justify-end mt-4">
            <button className="text-sm font-medium text-teal-600 hover:text-teal-700">EDIT</button>
          </div>
        </div>
      </div>

      {/* Terms of Service */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Terms of Service</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-x-8 gap-y-0">
            <div className="flex gap-4 py-2">
              <span className="text-sm text-gray-500 min-w-[140px]">Terms of Service</span>
              <span className="text-sm font-semibold text-gray-400">Not Accepted</span>
            </div>
            <div className="flex gap-4 py-2">
              <span className="text-sm text-gray-500 min-w-[140px]">Accepted on</span>
              <span className="text-sm font-semibold text-gray-400">-</span>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button className="text-sm font-medium text-teal-600 hover:text-teal-700">SEND TERMS OF SERVICE</button>
          </div>
        </div>
      </div>

      {/* Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Activity</h3>
        </div>
        <div className="p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Changed By</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Comment</th>
                <th className="pb-3 font-medium">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-3 font-semibold">Client Created</td>
                <td className="py-3 font-semibold">System</td>
                <td className="py-3 font-semibold">Approved</td>
                <td className="py-3 font-semibold text-gray-400">No Data</td>
                <td className="py-3 font-semibold">{formatDate(client.createdAt)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Add New Contact</h2>

              <div className="space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="First Name *"
                    value={contactForm.firstName}
                    onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm placeholder-gray-400"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Middle Name"
                    value={contactForm.middleName}
                    onChange={(e) => setContactForm({ ...contactForm, middleName: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm placeholder-gray-400"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Last Name *"
                    value={contactForm.lastName}
                    onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm placeholder-gray-400"
                  />
                </div>

                <div>
                  <input
                    type="email"
                    placeholder="Email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm placeholder-gray-400"
                  />
                </div>

                <div>
                  <input
                    type="tel"
                    placeholder="Home Phone Number"
                    value={contactForm.homePhone}
                    onChange={(e) => setContactForm({ ...contactForm, homePhone: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm placeholder-gray-400"
                  />
                </div>

                <div>
                  <input
                    type="tel"
                    placeholder="Cell Phone Number"
                    value={contactForm.cellPhone}
                    onChange={(e) => setContactForm({ ...contactForm, cellPhone: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm placeholder-gray-400"
                  />
                </div>

                <div className="pt-4 space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={contactForm.receiveJobNotifications}
                      onChange={(e) => setContactForm({ ...contactForm, receiveJobNotifications: e.target.checked })}
                      className="w-4 h-4 border-gray-300 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-gray-700">Receive job notifications</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={contactForm.receiveInvoicesEmail}
                      onChange={(e) => setContactForm({ ...contactForm, receiveInvoicesEmail: e.target.checked })}
                      className="w-4 h-4 border-gray-300 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-gray-700">Receive invoices via email</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-center gap-3 mt-8">
                <button
                  onClick={() => {
                    setShowContactModal(false);
                    resetContactForm();
                  }}
                  className="px-6 py-2 text-sm font-medium text-teal-600 hover:text-teal-700"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleSaveContact}
                  disabled={savingContact || !contactForm.firstName || !contactForm.lastName}
                  className="px-6 py-2 text-sm font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingContact ? "SAVING..." : "SAVE"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create New Subscription Modal */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Create New Subscription For {client?.fullName}
              </h2>

              <div className="space-y-5">
                {/* Service Plan */}
                <div>
                  <label className="block text-sm font-medium text-teal-600 mb-1">
                    Service Plan
                  </label>
                  <select
                    value={subscriptionForm.servicePlan}
                    onChange={(e) => setSubscriptionForm({ ...subscriptionForm, servicePlan: e.target.value })}
                    className="w-full px-3 py-2 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm bg-white"
                    disabled={loadingServicePlans}
                  >
                    <option value="">
                      {loadingServicePlans ? "Loading..." : "Please Select"}
                    </option>
                    {generateServicePlanOptions().map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {!subscriptionForm.servicePlan && (
                    <p className="text-xs text-red-500 mt-1">This field is required</p>
                  )}
                </div>

                {/* No Dogs Mode - Additional Fields */}
                {subscriptionForm.servicePlan === "NO_DOGS" && (
                  <>
                    {/* Service */}
                    <div>
                      <label className="block text-sm font-medium text-teal-600 mb-1">
                        Service
                      </label>
                      <select
                        value={subscriptionForm.service}
                        onChange={(e) => {
                          const selectedCrossSell = residentialCrossSells.find((cs) => cs.id === e.target.value);
                          setSubscriptionForm({
                            ...subscriptionForm,
                            service: e.target.value,
                            pricePerUnit: selectedCrossSell ? String(selectedCrossSell.pricePerUnit) : subscriptionForm.pricePerUnit,
                          });
                        }}
                        className="w-full px-3 py-2 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm bg-white"
                      >
                        <option value="">Please Select</option>
                        {residentialCrossSells.map((crossSell) => (
                          <option key={crossSell.id} value={crossSell.id}>
                            {crossSell.name}
                          </option>
                        ))}
                      </select>
                      {subscriptionForm.servicePlan === "NO_DOGS" && !subscriptionForm.service && (
                        <p className="text-xs text-red-500 mt-1">This field is required</p>
                      )}
                    </div>

                    {/* Price per Unit */}
                    <div>
                      <label className="block text-sm font-medium text-teal-600 mb-1">
                        Price per Unit
                      </label>
                      <div className="relative">
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={subscriptionForm.pricePerUnit}
                          onChange={(e) => setSubscriptionForm({ ...subscriptionForm, pricePerUnit: e.target.value })}
                          className="w-full pl-4 px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm"
                          placeholder="0.00"
                        />
                      </div>
                      {subscriptionForm.servicePlan === "NO_DOGS" && !subscriptionForm.pricePerUnit && (
                        <p className="text-xs text-red-500 mt-1">This field is required</p>
                      )}
                    </div>

                    {/* Service Frequency */}
                    <div>
                      <label className="block text-sm font-medium text-teal-600 mb-1">
                        Service Frequency
                      </label>
                      <select
                        value={subscriptionForm.serviceFrequency}
                        onChange={(e) => setSubscriptionForm({ ...subscriptionForm, serviceFrequency: e.target.value })}
                        className="w-full px-3 py-2 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm bg-white"
                      >
                        <option value="">Please Select</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="BIWEEKLY">Bi-Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                        <option value="ONETIME">One-Time</option>
                      </select>
                      {subscriptionForm.servicePlan === "NO_DOGS" && !subscriptionForm.serviceFrequency && (
                        <p className="text-xs text-red-500 mt-1">This field is required</p>
                      )}
                    </div>
                  </>
                )}

                {/* Start Date */}
                <div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <input
                      type="date"
                      value={subscriptionForm.startDate}
                      onChange={(e) => setSubscriptionForm({ ...subscriptionForm, startDate: e.target.value })}
                      placeholder="Start Date"
                      className="flex-1 px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm"
                    />
                  </div>
                  {!subscriptionForm.startDate && (
                    <p className="text-xs text-red-500 mt-1 ml-8">This field is required</p>
                  )}
                </div>

                {/* End Date */}
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <input
                    type="date"
                    value={subscriptionForm.endDate}
                    onChange={(e) => setSubscriptionForm({ ...subscriptionForm, endDate: e.target.value })}
                    placeholder="End Date"
                    className="flex-1 px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm"
                  />
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                  <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700">
                    Please keep the &quot;End Date&quot; field blank unless the client is seasonal. For example, if a client lives in Maine but visits Florida over the winter months, set the End Date to March 30. Most recurring clients do not have an End Date, so please leave the field blank.
                  </p>
                </div>

                {/* Billing Option */}
                <div>
                  <label className="block text-sm font-medium text-teal-600 mb-1">
                    Billing Option
                  </label>
                  <select
                    value={subscriptionForm.billingOption}
                    onChange={(e) => setSubscriptionForm({ ...subscriptionForm, billingOption: e.target.value })}
                    className="w-full px-3 py-2 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm bg-white"
                  >
                    <option value="postpaid-fixed">Postpaid Fixed</option>
                    <option value="prepaid-fixed">Prepaid Fixed (Default)</option>
                    <option value="postpaid-per-cleanup">Postpaid Per Cleanup</option>
                  </select>
                </div>

                {/* Billing Interval */}
                <div>
                  <label className="block text-sm font-medium text-teal-600 mb-1">
                    Billing Interval
                  </label>
                  <select
                    value={subscriptionForm.billingInterval}
                    onChange={(e) => setSubscriptionForm({ ...subscriptionForm, billingInterval: e.target.value })}
                    className="w-full px-3 py-2 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm bg-white"
                  >
                    <option value="annually">Annually</option>
                    <option value="semi-annually">Semi-Annually</option>
                    <option value="every-four-months">Every Four Months</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="every-two-months">Every Two Months</option>
                    <option value="monthly">Monthly (Default)</option>
                  </select>
                </div>

                {/* Coupon Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Coupon Code
                  </label>
                  <input
                    type="text"
                    value={subscriptionForm.couponCode}
                    onChange={(e) => setSubscriptionForm({ ...subscriptionForm, couponCode: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">(Optional)</p>
                </div>

                {/* Initial Cleanup Required */}
                <div className="pt-2">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={subscriptionForm.initialCleanupRequired}
                      onChange={(e) => setSubscriptionForm({ ...subscriptionForm, initialCleanupRequired: e.target.checked })}
                      className="w-4 h-4 border-gray-300 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-gray-700">Initial Cleanup Required</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button
                  onClick={() => {
                    setShowSubscriptionModal(false);
                    resetSubscriptionForm();
                  }}
                  className="px-6 py-2 text-sm font-medium text-teal-600 hover:text-teal-700"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleSaveSubscription}
                  disabled={
                    savingSubscription ||
                    !subscriptionForm.servicePlan ||
                    !subscriptionForm.startDate ||
                    (subscriptionForm.servicePlan === "NO_DOGS" &&
                      (!subscriptionForm.service || !subscriptionForm.pricePerUnit || !subscriptionForm.serviceFrequency))
                  }
                  className="px-6 py-2 text-sm font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingSubscription ? "SAVING..." : "SAVE"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
