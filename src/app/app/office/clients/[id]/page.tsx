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
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { ClientStatus, Frequency } from "@/lib/supabase/types";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

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

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  amountDueCents: number;
  tipCents: number;
  dueDate: string | null;
  paidAt: string | null;
  billingOption: string | null;
  billingInterval: string | null;
  paymentMethod: string | null;
  subscriptionId: string | null;
  createdAt: string;
}

interface PaymentMethodCard {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  name: string | null;
  isDefault: boolean;
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
  invoices: Invoice[];
  contacts: Contact[];
}

// Helper functions
const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

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

function getCardBrandDisplay(brand: string | null) {
  const b = (brand || "").toLowerCase();
  switch (b) {
    case "visa": return { label: "VISA", color: "text-blue-600" };
    case "mastercard": return { label: "MC", color: "text-orange-600" };
    case "amex": return { label: "AMEX", color: "text-blue-700" };
    case "discover": return { label: "DISC", color: "text-orange-500" };
    default: return { label: (brand || "CARD").toUpperCase(), color: "text-gray-600" };
  }
}

function AddCardForm({ clientId, onSuccess, onCancel }: {
  clientId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [nameOnCard, setNameOnCard] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    if (!nameOnCard.trim()) {
      setError("Please enter the name on card.");
      return;
    }
    setProcessing(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        setError("Failed to initialize card setup.");
        setProcessing(false);
        return;
      }
      const { clientSecret } = await res.json();

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setError("Card element not found.");
        setProcessing(false);
        return;
      }

      const { error: stripeError } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: { name: nameOnCard },
        },
      });

      if (stripeError) {
        setError(stripeError.message || "An error occurred.");
        setProcessing(false);
      } else {
        onSuccess();
      }
    } catch {
      setError("Failed to add card.");
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-100 px-4 py-3 rounded text-sm font-medium text-gray-700">
        Credit Card Info
      </div>

      <div>
        <input
          type="text"
          placeholder="Name On Card"
          value={nameOnCard}
          onChange={(e) => setNameOnCard(e.target.value)}
          disabled={processing}
          className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm placeholder-gray-400"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Card</label>
        <div className="py-2 border-b border-gray-300">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "16px",
                  color: "#002842",
                  fontFamily: '"Inter", system-ui, sans-serif',
                  "::placeholder": { color: "#9CA3AF" },
                },
                invalid: { color: "#EF4444" },
              },
              hidePostalCode: true,
            }}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <p className="text-xs text-gray-500 italic">
        *Enter Credit Card to Be Used for Payments.
      </p>

      <div className="flex justify-center gap-3 mt-6">
        <button
          onClick={onCancel}
          disabled={processing}
          className="px-6 py-2 text-sm font-medium text-teal-600 hover:text-teal-700"
        >
          CANCEL
        </button>
        <button
          onClick={handleSubmit}
          disabled={processing || !stripe}
          className="px-6 py-2 text-sm font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? "ADDING..." : "ADD CARD"}
        </button>
      </div>
    </div>
  );
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

  // Edit contact modal state
  const [editingContactId, setEditingContactId] = useState<string | null>(null); // "primary" or contact id
  const [editContactForm, setEditContactForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    homePhone: "",
    cellPhone: "",
    taxExempt: false,
  });
  const [savingEditContact, setSavingEditContact] = useState(false);

  // Edit location modal state
  const [showEditLocationModal, setShowEditLocationModal] = useState(false);
  const [editLocationForm, setEditLocationForm] = useState({
    locationId: "",
    addressLine1: "",
    city: "",
    state: "",
    zipCode: "",
  });
  const [savingEditLocation, setSavingEditLocation] = useState(false);

  // Credit card state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [showCardLinkModal, setShowCardLinkModal] = useState(false);
  const [cardLinkUrl, setCardLinkUrl] = useState<string | null>(null);
  const [cardLinkCopied, setCardLinkCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  // Create invoice draft modal state
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

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

  // Gift certificate modal state
  const [showGiftCertModal, setShowGiftCertModal] = useState(false);
  const [giftCertForm, setGiftCertForm] = useState({
    purchaserName: "",
    purchaserEmail: "",
    purchaserPhone: "",
    amount: "",
    expiresAt: "",
    purchasedAt: "",
    referenceNumber: "",
    specialNote: "",
  });
  const [savingGiftCert, setSavingGiftCert] = useState(false);

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

  const handleEditContact = (type: "primary" | string) => {
    if (type === "primary" && client) {
      setEditContactForm({
        firstName: client.firstName || "",
        middleName: "",
        lastName: client.lastName || "",
        email: client.email || "",
        homePhone: client.phone ? formatPhoneNumber(client.phone) : "",
        cellPhone: client.secondaryPhone ? formatPhoneNumber(client.secondaryPhone) : "",
        taxExempt: false,
      });
    } else {
      const contact = client?.contacts.find((c) => c.id === type);
      if (contact) {
        setEditContactForm({
          firstName: contact.firstName || "",
          middleName: contact.middleName || "",
          lastName: contact.lastName || "",
          email: contact.email || "",
          homePhone: contact.homePhone ? formatPhoneNumber(contact.homePhone) : "",
          cellPhone: contact.cellPhone ? formatPhoneNumber(contact.cellPhone) : "",
          taxExempt: false,
        });
      }
    }
    setEditingContactId(type);
  };

  const handleSaveEditContact = async () => {
    if (!editContactForm.firstName || !editContactForm.lastName) return;
    setSavingEditContact(true);

    try {
      if (editingContactId === "primary") {
        const res = await fetch("/api/admin/clients", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            firstName: editContactForm.firstName,
            lastName: editContactForm.lastName,
            email: editContactForm.email || null,
            phone: editContactForm.homePhone || null,
            secondaryPhone: editContactForm.cellPhone || null,
          }),
        });

        if (res.ok) {
          if (client) {
            setClient({
              ...client,
              firstName: editContactForm.firstName,
              lastName: editContactForm.lastName,
              fullName: `${editContactForm.firstName} ${editContactForm.lastName}`.trim(),
              email: editContactForm.email || null,
              phone: editContactForm.homePhone || null,
              secondaryPhone: editContactForm.cellPhone || null,
            });
          }
          setEditingContactId(null);
        } else {
          const data = await res.json();
          alert(data.error || "Failed to update contact info");
        }
      } else {
        const res = await fetch(`/api/admin/clients/${id}/contacts`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingContactId,
            firstName: editContactForm.firstName,
            middleName: editContactForm.middleName || null,
            lastName: editContactForm.lastName,
            email: editContactForm.email || null,
            homePhone: editContactForm.homePhone || null,
            cellPhone: editContactForm.cellPhone || null,
          }),
        });

        if (res.ok) {
          if (client) {
            setClient({
              ...client,
              contacts: client.contacts.map((c) =>
                c.id === editingContactId
                  ? {
                      ...c,
                      firstName: editContactForm.firstName,
                      middleName: editContactForm.middleName || null,
                      lastName: editContactForm.lastName || null,
                      email: editContactForm.email || null,
                      homePhone: editContactForm.homePhone || null,
                      cellPhone: editContactForm.cellPhone || null,
                    }
                  : c
              ),
            });
          }
          setEditingContactId(null);
        } else {
          const data = await res.json();
          alert(data.error || "Failed to update contact");
        }
      }
    } catch (err) {
      console.error("Error updating contact:", err);
      alert("Failed to update contact");
    } finally {
      setSavingEditContact(false);
    }
  };

  const handleEditLocation = () => {
    if (!primaryLocation) return;
    setEditLocationForm({
      locationId: primaryLocation.id,
      addressLine1: primaryLocation.addressLine1 || "",
      city: primaryLocation.city || "",
      state: primaryLocation.state || "",
      zipCode: primaryLocation.zipCode || "",
    });
    setShowEditLocationModal(true);
  };

  const handleSaveEditLocation = async () => {
    if (!editLocationForm.addressLine1 || !editLocationForm.zipCode || !editLocationForm.city) return;
    setSavingEditLocation(true);

    try {
      const res = await fetch(`/api/admin/clients/${id}/locations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editLocationForm),
      });

      if (res.ok) {
        const data = await res.json();
        if (client) {
          setClient({
            ...client,
            locations: client.locations.map((l) =>
              l.id === editLocationForm.locationId ? data.location : l
            ),
          });
        }
        setShowEditLocationModal(false);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update location");
      }
    } catch (err) {
      console.error("Error updating location:", err);
      alert("Failed to update location");
    } finally {
      setSavingEditLocation(false);
    }
  };

  const handleCreateInvoiceDraft = async () => {
    setCreatingInvoice(true);
    try {
      const activeDogCount = client?.dogs?.filter((d) => d.isActive).length || 0;
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: id,
          items: [
            {
              description: `One Time Job: ${activeDogCount}d 0.00-0.00`,
              quantity: 1,
              unitPriceCents: 0,
            },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const inv = data.invoice;
        if (client) {
          setClient({
            ...client,
            invoices: [
              {
                id: inv.id,
                invoiceNumber: inv.invoice_number,
                status: inv.status,
                subtotalCents: inv.subtotal_cents,
                discountCents: inv.discount_cents,
                taxCents: inv.tax_cents,
                totalCents: inv.total_cents,
                amountPaidCents: inv.amount_paid_cents,
                amountDueCents: inv.amount_due_cents,
                tipCents: inv.tip_cents || 0,
                dueDate: inv.due_date,
                paidAt: inv.paid_at,
                billingOption: inv.billing_option || "PREPAID_VARIABLE",
                billingInterval: inv.billing_interval || "ONCE",
                paymentMethod: inv.payment_method || "CREDIT_CARD",
                subscriptionId: inv.subscription_id,
                createdAt: inv.created_at,
              },
              ...client.invoices,
            ],
          });
        }
        setShowCreateInvoiceModal(false);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create invoice draft");
      }
    } catch (err) {
      console.error("Error creating invoice draft:", err);
      alert("Failed to create invoice draft");
    } finally {
      setCreatingInvoice(false);
    }
  };

  const fetchPaymentMethods = async () => {
    setLoadingCards(true);
    try {
      const res = await fetch(`/api/admin/clients/${id}/cards`);
      if (res.ok) {
        const data = await res.json();
        setPaymentMethods(data.cards || []);
      }
    } catch (err) {
      console.error("Error fetching cards:", err);
    } finally {
      setLoadingCards(false);
    }
  };

  const handleDeleteCard = async (paymentMethodId: string) => {
    if (!confirm("Are you sure you want to remove this card?")) return;
    setDeletingCardId(paymentMethodId);
    try {
      const res = await fetch(`/api/admin/clients/${id}/cards`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId }),
      });
      if (res.ok) {
        setPaymentMethods((prev) => prev.filter((pm) => pm.id !== paymentMethodId));
      } else {
        alert("Failed to remove card");
      }
    } catch (err) {
      console.error("Error deleting card:", err);
      alert("Failed to remove card");
    } finally {
      setDeletingCardId(null);
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    setSettingDefaultId(paymentMethodId);
    try {
      const res = await fetch(`/api/admin/clients/${id}/cards`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId }),
      });
      if (res.ok) {
        setPaymentMethods((prev) =>
          prev.map((pm) => ({ ...pm, isDefault: pm.id === paymentMethodId }))
        );
      } else {
        alert("Failed to set default card");
      }
    } catch (err) {
      console.error("Error setting default:", err);
      alert("Failed to set default card");
    } finally {
      setSettingDefaultId(null);
    }
  };

  const handleGenerateCardLink = async () => {
    setGeneratingLink(true);
    try {
      const res = await fetch(`/api/admin/clients/${id}/cards/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setCardLinkUrl(data.link);
        setShowCardLinkModal(true);
      } else {
        alert("Failed to generate card link");
      }
    } catch (err) {
      console.error("Error generating card link:", err);
      alert("Failed to generate card link");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleSaveGiftCert = async () => {
    if (!giftCertForm.amount) return;
    setSavingGiftCert(true);
    try {
      const res = await fetch("/api/admin/gift-certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(giftCertForm.amount),
          purchaserName: giftCertForm.purchaserName || undefined,
          purchaserEmail: giftCertForm.purchaserEmail || undefined,
          purchaserPhone: giftCertForm.purchaserPhone || undefined,
          clientId: id,
          recipientName: client?.fullName || undefined,
          recipientEmail: client?.email || undefined,
          expiresAt: giftCertForm.expiresAt || undefined,
          purchasedAt: giftCertForm.purchasedAt || undefined,
          referenceNumber: giftCertForm.referenceNumber || undefined,
          message: giftCertForm.specialNote || undefined,
        }),
      });
      if (res.ok) {
        setShowGiftCertModal(false);
        setGiftCertForm({
          purchaserName: "",
          purchaserEmail: "",
          purchaserPhone: "",
          amount: "",
          expiresAt: "",
          purchasedAt: "",
          referenceNumber: "",
          specialNote: "",
        });
        // Refresh client data to show new gift cert
        const refreshRes = await fetch(`/api/admin/clients/${id}`);
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setClient(data.client);
        }
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create gift certificate");
      }
    } catch (err) {
      console.error("Error creating gift certificate:", err);
      alert("Failed to create gift certificate");
    } finally {
      setSavingGiftCert(false);
    }
  };

  // Fetch payment methods when cards tab is selected
  useEffect(() => {
    if (billingTab === "cards" && client) {
      fetchPaymentMethods();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billingTab]);

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
                  <span className="text-sm font-semibold text-gray-900">{client.phone ? formatPhoneNumber(client.phone) : "No Data"}</span>
                </div>
                <div className="flex gap-4 py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500 min-w-[140px]">Middle Name</span>
                  <span className="text-sm font-semibold text-gray-400">No Data</span>
                </div>
                <div className="flex gap-4 py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500 min-w-[140px]">Cell Phone Number</span>
                  <span className="text-sm font-semibold text-gray-900">{client.secondaryPhone ? formatPhoneNumber(client.secondaryPhone) : "No Data"}</span>
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
                <button onClick={() => handleEditContact("primary")} className="text-sm font-medium text-teal-600 hover:text-teal-700">EDIT</button>
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
                    <span className="text-sm font-semibold text-gray-900">{contact.homePhone ? formatPhoneNumber(contact.homePhone) : "No Data"}</span>
                  </div>
                  <div className="flex gap-4 py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500 min-w-[140px]">Middle Name</span>
                    <span className={`text-sm font-semibold ${contact.middleName ? "text-gray-900" : "text-gray-400"}`}>
                      {contact.middleName || "No Data"}
                    </span>
                  </div>
                  <div className="flex gap-4 py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500 min-w-[140px]">Cell Phone Number</span>
                    <span className="text-sm font-semibold text-gray-900">{contact.cellPhone ? formatPhoneNumber(contact.cellPhone) : "No Data"}</span>
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
                  <button onClick={() => handleEditContact(contact.id)} className="text-sm font-medium text-teal-600 hover:text-teal-700">EDIT</button>
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
            <button onClick={handleEditLocation} className="text-sm font-medium text-teal-600 hover:text-teal-700">EDIT</button>
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
                      <th className="pb-3 font-medium">Invoices #</th>
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium">Payment Method</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Invoice Total</th>
                      <th className="pb-3 font-medium">Tip</th>
                      <th className="pb-3 font-medium">Invoice Remaining</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {client.invoices?.length > 0 ? (
                      client.invoices.map((invoice) => (
                        <tr key={invoice.id}>
                          <td className="py-3 font-semibold">
                            {new Date(invoice.createdAt).toLocaleString("en-US", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              hour12: false,
                            })}
                          </td>
                          <td className="py-3 font-semibold text-teal-600">{invoice.invoiceNumber}</td>
                          <td className="py-3 font-semibold">{invoice.subscriptionId ? "Subscription" : "One Time"}</td>
                          <td className="py-3 font-semibold">
                            {invoice.paymentMethod === "CREDIT_CARD" ? "Credit Card"
                              : invoice.paymentMethod === "CHECK" ? "Check"
                              : invoice.paymentMethod === "CASH" ? "Cash"
                              : invoice.paymentMethod === "ACH" ? "ACH"
                              : "Credit Card"}
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              invoice.status === "DRAFT" ? "text-red-600 bg-red-50"
                                : invoice.status === "PAID" ? "text-green-700 bg-green-100"
                                : invoice.status === "OPEN" ? "text-blue-700 bg-blue-100"
                                : invoice.status === "VOID" ? "text-gray-700 bg-gray-100"
                                : "text-orange-700 bg-orange-100"
                            }`}>
                              {invoice.status}
                            </span>
                          </td>
                          <td className="py-3 font-semibold">{formatCurrency(invoice.totalCents)}</td>
                          <td className="py-3 font-semibold">{formatCurrency(invoice.tipCents)}</td>
                          <td className="py-3 font-semibold">{formatCurrency(invoice.amountDueCents)}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <button className="text-teal-600 hover:text-teal-700 text-sm flex items-center gap-1">
                                View <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button className="text-gray-400 hover:text-gray-600 text-sm">More ...</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-gray-400">No invoices</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowCreateInvoiceModal(true)}
                  className="text-sm font-medium text-teal-600 hover:text-teal-700"
                >
                  CREATE INVOICE DRAFT
                </button>
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
                    {loadingCards ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center">
                          <div className="inline-block animate-spin w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full" />
                        </td>
                      </tr>
                    ) : paymentMethods.length > 0 ? (
                      paymentMethods.map((pm) => {
                        const brand = getCardBrandDisplay(pm.brand);
                        return (
                          <tr key={pm.id}>
                            <td className="py-3 font-semibold">
                              <span className={`font-bold ${brand.color}`}>{brand.label}</span>
                              <span className="ml-2">xxxx {pm.last4}</span>
                              {pm.isDefault && (
                                <span className="ml-2 text-teal-600 text-xs">(Default)</span>
                              )}
                            </td>
                            <td className="py-3 font-semibold">{pm.name || fullName}</td>
                            <td className="py-3 font-semibold">
                              {pm.expMonth?.toString().padStart(2, "0")}/{pm.expYear}
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-4">
                                <button
                                  onClick={() => handleSetDefault(pm.id)}
                                  disabled={pm.isDefault || settingDefaultId === pm.id}
                                  className={`text-sm flex items-center gap-1 ${
                                    pm.isDefault
                                      ? "text-gray-300 cursor-default"
                                      : "text-gray-500 hover:text-teal-600"
                                  }`}
                                >
                                  Set Default {settingDefaultId === pm.id ? "..." : ""}
                                  {pm.isDefault && <CheckCircle className="w-3.5 h-3.5 text-teal-500" />}
                                </button>
                                <button
                                  onClick={() => handleDeleteCard(pm.id)}
                                  disabled={deletingCardId === pm.id}
                                  className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                                >
                                  Delete {deletingCardId === pm.id ? "..." : ""}
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-gray-400">No credit cards on file</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-4 mt-4">
                <button
                  onClick={handleGenerateCardLink}
                  disabled={generatingLink}
                  className="text-sm font-medium text-teal-600 hover:text-teal-700 disabled:opacity-50"
                >
                  {generatingLink ? "GENERATING..." : "CREATE CARD LINK"}
                </button>
                <button
                  onClick={() => setShowAddCardModal(true)}
                  className="text-sm font-medium text-teal-600 hover:text-teal-700"
                >
                  ADD CARD
                </button>
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
                <button
                  onClick={() => setShowGiftCertModal(true)}
                  className="text-sm font-medium text-teal-600 hover:text-teal-700"
                >
                  CREATE GIFT CERTIFICATE
                </button>
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
                    onChange={(e) => setContactForm({ ...contactForm, homePhone: formatPhoneNumber(e.target.value) })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm placeholder-gray-400"
                  />
                </div>

                <div>
                  <input
                    type="tel"
                    placeholder="Cell Phone Number"
                    value={contactForm.cellPhone}
                    onChange={(e) => setContactForm({ ...contactForm, cellPhone: formatPhoneNumber(e.target.value) })}
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

      {/* Edit Contact Info Modal */}
      {editingContactId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Edit Contact Info</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">First Name*</label>
                  <input
                    type="text"
                    value={editContactForm.firstName}
                    onChange={(e) => setEditContactForm({ ...editContactForm, firstName: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Middle Name"
                    value={editContactForm.middleName}
                    onChange={(e) => setEditContactForm({ ...editContactForm, middleName: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm placeholder-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Last Name*</label>
                  <input
                    type="text"
                    value={editContactForm.lastName}
                    onChange={(e) => setEditContactForm({ ...editContactForm, lastName: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email</label>
                  <input
                    type="email"
                    value={editContactForm.email}
                    onChange={(e) => setEditContactForm({ ...editContactForm, email: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm"
                  />
                </div>

                <div>
                  <input
                    type="tel"
                    placeholder="Home Phone Number"
                    value={editContactForm.homePhone}
                    onChange={(e) => setEditContactForm({ ...editContactForm, homePhone: formatPhoneNumber(e.target.value) })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm placeholder-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cell Phone Number</label>
                  <input
                    type="tel"
                    value={editContactForm.cellPhone}
                    onChange={(e) => setEditContactForm({ ...editContactForm, cellPhone: formatPhoneNumber(e.target.value) })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm"
                  />
                </div>

                <div className="pt-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={editContactForm.taxExempt}
                      onChange={(e) => setEditContactForm({ ...editContactForm, taxExempt: e.target.checked })}
                      className="w-4 h-4 border-gray-300 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-gray-700">Tax exempt</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-center gap-3 mt-8">
                <button
                  onClick={() => setEditingContactId(null)}
                  className="px-6 py-2 text-sm font-medium text-teal-600 hover:text-teal-700"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleSaveEditContact}
                  disabled={savingEditContact || !editContactForm.firstName || !editContactForm.lastName}
                  className="px-6 py-2 text-sm font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingEditContact ? "SAVING..." : "SAVE"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Invoice Draft Modal */}
      {showCreateInvoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Create Invoice Draft</h2>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold">i</span>
                </div>
                <p className="text-sm text-gray-700">
                  This action will create One Time Invoice Draft.
                </p>
              </div>

              <div className="flex justify-center gap-3 mt-8">
                <button
                  onClick={() => setShowCreateInvoiceModal(false)}
                  className="px-6 py-2 text-sm font-medium text-teal-600 hover:text-teal-700"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleCreateInvoiceDraft}
                  disabled={creatingInvoice}
                  className="px-6 py-2 text-sm font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingInvoice ? "CREATING..." : "CREATE"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card Link Modal */}
      {showCardLinkModal && cardLinkUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Link has been created</h2>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3 mb-4">
                <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold">i</span>
                </div>
                <p className="text-sm text-gray-700">This link will expire in 24 hours</p>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Add Credit Card Link</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={cardLinkUrl}
                    readOnly
                    className="flex-1 px-0 py-2 border-0 border-b border-gray-300 text-sm text-gray-700 bg-transparent outline-none"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(cardLinkUrl);
                      setCardLinkCopied(true);
                      setTimeout(() => setCardLinkCopied(false), 2000);
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600"
                    title="Copy to clipboard"
                  >
                    {cardLinkCopied ? (
                      <CheckCircle className="w-5 h-5 text-teal-500" />
                    ) : (
                      <FileText className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => {
                    setShowCardLinkModal(false);
                    setCardLinkUrl(null);
                    setCardLinkCopied(false);
                  }}
                  className="px-6 py-2 text-sm font-medium text-white bg-teal-600 rounded hover:bg-teal-700"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Card Modal */}
      {showAddCardModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Add Card</h2>
              <Elements stripe={stripePromise}>
                <AddCardForm
                  clientId={id}
                  onSuccess={() => {
                    setShowAddCardModal(false);
                    fetchPaymentMethods();
                  }}
                  onCancel={() => setShowAddCardModal(false)}
                />
              </Elements>
            </div>
          </div>
        </div>
      )}

      {/* Edit Location Modal */}
      {showEditLocationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Edit Location</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Home Address *</label>
                  <input
                    type="text"
                    value={editLocationForm.addressLine1}
                    onChange={(e) => setEditLocationForm({ ...editLocationForm, addressLine1: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Zip Code *</label>
                  <input
                    type="text"
                    value={editLocationForm.zipCode}
                    onChange={(e) => setEditLocationForm({ ...editLocationForm, zipCode: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">City *</label>
                  <input
                    type="text"
                    value={editLocationForm.city}
                    onChange={(e) => setEditLocationForm({ ...editLocationForm, city: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">State</label>
                  <select
                    value={editLocationForm.state}
                    onChange={(e) => setEditLocationForm({ ...editLocationForm, state: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm bg-white appearance-none"
                  >
                    <option value="">Select state</option>
                    {Object.entries(US_STATES).map(([abbr, name]) => (
                      <option key={abbr} value={abbr}>
                        {name} - {abbr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Country</label>
                  <input
                    type="text"
                    value="United States"
                    disabled
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 text-sm text-gray-500 bg-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-center gap-3 mt-8">
                <button
                  onClick={() => setShowEditLocationModal(false)}
                  className="px-6 py-2 text-sm font-medium text-teal-600 hover:text-teal-700"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleSaveEditLocation}
                  disabled={savingEditLocation || !editLocationForm.addressLine1 || !editLocationForm.zipCode || !editLocationForm.city}
                  className="px-6 py-2 text-sm font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingEditLocation ? "SAVING..." : "SAVE"}
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
                            pricePerUnit: selectedCrossSell ? String(selectedCrossSell.pricePerUnit / 100) : subscriptionForm.pricePerUnit,
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
                      type={subscriptionForm.startDate ? "date" : "text"}
                      value={subscriptionForm.startDate}
                      onChange={(e) => setSubscriptionForm({ ...subscriptionForm, startDate: e.target.value })}
                      onFocus={(e) => (e.target.type = "date")}
                      onBlur={(e) => { if (!subscriptionForm.startDate) e.target.type = "text"; }}
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
                    type={subscriptionForm.endDate ? "date" : "text"}
                    value={subscriptionForm.endDate}
                    onChange={(e) => setSubscriptionForm({ ...subscriptionForm, endDate: e.target.value })}
                    onFocus={(e) => (e.target.type = "date")}
                    onBlur={(e) => { if (!subscriptionForm.endDate) e.target.type = "text"; }}
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

      {/* Create Gift Certificate Modal */}
      {showGiftCertModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Create New Gift Certificate For {client?.fullName}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Purchaser Name</label>
                  <input
                    type="text"
                    value={giftCertForm.purchaserName}
                    onChange={(e) => setGiftCertForm({ ...giftCertForm, purchaserName: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Purchaser Email</label>
                  <input
                    type="email"
                    value={giftCertForm.purchaserEmail}
                    onChange={(e) => setGiftCertForm({ ...giftCertForm, purchaserEmail: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Purchaser Phone</label>
                  <input
                    type="tel"
                    value={giftCertForm.purchaserPhone}
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value);
                      setGiftCertForm({ ...giftCertForm, purchaserPhone: formatted });
                    }}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm"
                    placeholder="(XXX) XXX-XXXX"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Amount *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={giftCertForm.amount}
                      onChange={(e) => setGiftCertForm({ ...giftCertForm, amount: e.target.value })}
                      className="w-full pl-5 pr-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Expires</label>
                  <div className="relative">
                    <Calendar className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      value={giftCertForm.expiresAt}
                      onChange={(e) => setGiftCertForm({ ...giftCertForm, expiresAt: e.target.value })}
                      className="w-full pl-5 pr-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Bought</label>
                  <div className="relative">
                    <Calendar className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      value={giftCertForm.purchasedAt}
                      onChange={(e) => setGiftCertForm({ ...giftCertForm, purchasedAt: e.target.value })}
                      className="w-full pl-5 pr-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Reference Number</label>
                  <input
                    type="text"
                    value={giftCertForm.referenceNumber}
                    onChange={(e) => setGiftCertForm({ ...giftCertForm, referenceNumber: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Special Note</label>
                  <input
                    type="text"
                    value={giftCertForm.specialNote}
                    onChange={(e) => setGiftCertForm({ ...giftCertForm, specialNote: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b border-gray-300 focus:border-teal-500 focus:ring-0 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-center gap-3 mt-8">
                <button
                  onClick={() => {
                    setShowGiftCertModal(false);
                    setGiftCertForm({
                      purchaserName: "",
                      purchaserEmail: "",
                      purchaserPhone: "",
                      amount: "",
                      expiresAt: "",
                      purchasedAt: "",
                      referenceNumber: "",
                      specialNote: "",
                    });
                  }}
                  className="px-6 py-2 text-sm font-medium text-teal-600 hover:text-teal-700"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleSaveGiftCert}
                  disabled={savingGiftCert || !giftCertForm.amount}
                  className="px-6 py-2 text-sm font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingGiftCert ? "SAVING..." : "SAVE"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
