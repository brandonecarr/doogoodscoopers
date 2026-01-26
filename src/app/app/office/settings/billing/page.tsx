"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// Types
interface BillingSettings {
  billingOption: "prepaid_fixed" | "prepaid_variable" | "postpaid";
  billingInterval: "daily" | "weekly" | "biweekly" | "monthly";
  salesTaxCalculatorType: "manual" | "automatic";
  salesTaxService: number;
  salesTaxProduct: number;
  onboardingPriceDisplay: "per_cleanup" | "per_interval";
  startOfBillingCycle: "1st" | "15th" | "rolling";
  netTerms: number;
  emailInvoices: boolean;
  invoiceEmailNoteResidential: string;
  invoiceEmailNoteCommercial: string;
  invoicePdfNoteResidential: { hideFooter: boolean; title: string; content: string };
  invoicePdfNoteCommercial: { hideFooter: boolean; title: string; content: string };
  skippedCleanupsResidential: SkipReason[];
  skippedCleanupsCommercial: SkipReason[];
}

interface SkipReason {
  reason: string;
  moreInfo: string;
  cost: number;
}

const defaultResidentialReasons: SkipReason[] = [
  { reason: "Unsafe dog", moreInfo: "Aggressive, Vicious or Dangerous Dog", cost: 0 },
  { reason: "Locked Gate", moreInfo: "Wrong Code, Bad Key,...", cost: 0 },
  { reason: "Gate Issue", moreInfo: "Blocked Entrance, Frozen at Ground Level", cost: 0 },
  { reason: "Bad Weather Conditions", moreInfo: "Snow, Rain, Lighting, Cold, Heat,..", cost: 0 },
  { reason: "Unfavorable Yard Conditions", moreInfo: "Too Many Leaves, Tall Grass,..", cost: 0 },
  { reason: "Can't Find Location", moreInfo: "Wrong Address, Street Closure,...", cost: 0 },
  { reason: "Holiday", moreInfo: "", cost: 0 },
  { reason: "Non-Payment", moreInfo: "", cost: 0 },
  { reason: "Client Request", moreInfo: "", cost: 0 },
  { reason: "Other", moreInfo: "", cost: 0 },
];

const defaultCommercialReasons: SkipReason[] = [
  { reason: "Gates Closed or No Access", moreInfo: "", cost: 0 },
  { reason: "No Dog Station Keys", moreInfo: "", cost: 0 },
  { reason: "Damaged Pet Station", moreInfo: "", cost: 0 },
  { reason: "Bad Weather Conditions", moreInfo: "", cost: 0 },
  { reason: "Can't Find Location", moreInfo: "", cost: 0 },
  { reason: "Holiday", moreInfo: "", cost: 0 },
  { reason: "Non-Payment", moreInfo: "", cost: 0 },
  { reason: "Client Request", moreInfo: "", cost: 0 },
  { reason: "Other", moreInfo: "", cost: 0 },
];

// Modal Component
function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  onSave,
  saving,
  wide,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
  wide?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className={`relative bg-white rounded-lg shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-md"}`}>
          <div className="p-6 pb-4">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          </div>
          <div className="px-6 pb-6 max-h-[60vh] overflow-y-auto">{children}</div>
          <div className="flex justify-end gap-3 px-6 pb-6">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:text-gray-800">
              CANCEL
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="px-4 py-2 bg-teal-600 text-white font-medium rounded-md hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? "SAVING..." : "SAVE"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Setting Row Component
function SettingRow({
  title,
  value,
  description,
  onEdit,
  buttons,
  warning,
}: {
  title: string;
  value?: string;
  description?: string;
  onEdit?: () => void;
  buttons?: React.ReactNode;
  warning?: string;
}) {
  return (
    <section className="bg-white rounded-lg border border-gray-200">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {value && <p className="text-teal-600 font-medium mt-1">{value}</p>}
            {description && <p className="text-sm text-gray-500 mt-2">{description}</p>}
            {warning && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-md flex items-start gap-2">
                <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-orange-800">{warning}</p>
              </div>
            )}
          </div>
          {onEdit && (
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700"
            >
              EDIT
            </button>
          )}
          {buttons && <div className="flex flex-col gap-2">{buttons}</div>}
        </div>
      </div>
    </section>
  );
}

// Radio Select Modal Content
function RadioSelect({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; description?: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      {options.map((option) => (
        <label key={option.value} className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="radioSelect"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="mt-1 h-4 w-4 text-teal-600 border-gray-300 focus:ring-teal-500"
          />
          <div>
            <p className="font-medium text-gray-900">{option.label}</p>
            {option.description && <p className="text-sm text-gray-500">{option.description}</p>}
          </div>
        </label>
      ))}
    </div>
  );
}

export default function BillingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<BillingSettings>({
    billingOption: "prepaid_fixed",
    billingInterval: "monthly",
    salesTaxCalculatorType: "manual",
    salesTaxService: 0,
    salesTaxProduct: 0,
    onboardingPriceDisplay: "per_cleanup",
    startOfBillingCycle: "1st",
    netTerms: 0,
    emailInvoices: true,
    invoiceEmailNoteResidential: "",
    invoiceEmailNoteCommercial: "",
    invoicePdfNoteResidential: { hideFooter: false, title: "Thank You!", content: "" },
    invoicePdfNoteCommercial: { hideFooter: false, title: "Thank You!", content: "" },
    skippedCleanupsResidential: defaultResidentialReasons,
    skippedCleanupsCommercial: defaultCommercialReasons,
  });

  // Modal states
  const [editModal, setEditModal] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editSkipCosts, setEditSkipCosts] = useState<SkipReason[]>([]);
  const [editPdfNote, setEditPdfNote] = useState({ hideFooter: false, title: "", content: "" });
  const [editEmailBody, setEditEmailBody] = useState("");

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const result = await res.json();
        const billing = result.settings?.billing || {};
        setSettings({
          billingOption: billing.billingOption || "prepaid_fixed",
          billingInterval: billing.billingInterval || "monthly",
          salesTaxCalculatorType: billing.salesTaxCalculatorType || "manual",
          salesTaxService: billing.salesTaxService || 0,
          salesTaxProduct: billing.salesTaxProduct || 0,
          onboardingPriceDisplay: billing.onboardingPriceDisplay || "per_cleanup",
          startOfBillingCycle: billing.startOfBillingCycle || "1st",
          netTerms: billing.netTerms || 0,
          emailInvoices: billing.emailInvoices ?? true,
          invoiceEmailNoteResidential: billing.invoiceEmailNoteResidential || "",
          invoiceEmailNoteCommercial: billing.invoiceEmailNoteCommercial || "",
          invoicePdfNoteResidential: billing.invoicePdfNoteResidential || { hideFooter: false, title: "Thank You!", content: "" },
          invoicePdfNoteCommercial: billing.invoicePdfNoteCommercial || { hideFooter: false, title: "Thank You!", content: "" },
          skippedCleanupsResidential: billing.skippedCleanupsResidential || defaultResidentialReasons,
          skippedCleanupsCommercial: billing.skippedCleanupsCommercial || defaultCommercialReasons,
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async (updates: Partial<BillingSettings>) => {
    setSaving(true);
    try {
      const newSettings = { ...settings, ...updates };
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { billing: newSettings } }),
      });
      if (res.ok) {
        setSettings(newSettings);
        setEditModal(null);
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const getBillingOptionLabel = () => {
    const labels: Record<string, string> = {
      prepaid_fixed: "PREPAID FIXED",
      prepaid_variable: "PREPAID VARIABLE",
      postpaid: "POSTPAID",
    };
    return labels[settings.billingOption] || settings.billingOption;
  };

  const getBillingIntervalLabel = () => {
    const labels: Record<string, string> = {
      daily: "DAILY",
      weekly: "WEEKLY",
      biweekly: "BIWEEKLY",
      monthly: "MONTHLY",
    };
    return labels[settings.billingInterval] || settings.billingInterval;
  };

  const getStartOfBillingCycleLabel = () => {
    const labels: Record<string, string> = {
      "1st": "1ST OF THE MONTH",
      "15th": "15TH OF THE MONTH",
      rolling: "ROLLING BASIS",
    };
    return labels[settings.startOfBillingCycle] || settings.startOfBillingCycle;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500">
        <Link href="/app/office/settings" className="text-teal-600 hover:text-teal-700">
          SETTINGS
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-400">BILLING</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
      </div>

      {/* Stripe Section */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Your payment processing platform</h2>
            <p className="text-2xl font-bold text-gray-800 mt-2">stripe</p>
            <p className="text-sm text-gray-500 mt-2">
              Please manage your identity, bank information and payouts within Stripe Express Dashboard. Sweep&Go uses Stripe to process credit card payments on our behalf.
            </p>
          </div>
          <a
            href="https://connect.stripe.com/express_login"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 whitespace-nowrap"
          >
            VISIT STRIPE EXPRESS DASHBOARD
          </a>
        </div>
        {/* Info banner */}
        <div className="mt-4 p-3 border border-gray-200 rounded-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-gray-600">
              You exceeded $15,000 volume over the last 3 months.{" "}
              <a href="#" className="text-teal-600 hover:text-teal-700">Get a free quote from Clover Connect</a>
            </span>
          </div>
          <button className="text-teal-600 font-medium text-sm hover:text-teal-700">GOT IT</button>
        </div>
      </section>

      {/* Billing Option */}
      <SettingRow
        title="Billing Option"
        value={getBillingOptionLabel()}
        description="Please choose prepaid if you bill before services are performed and choose postpaid if you bill after services are performed. Your change will only affect new client subscriptions."
        onEdit={() => {
          setEditValue(settings.billingOption);
          setEditModal("billingOption");
        }}
      />

      {/* Billing Interval */}
      <SettingRow
        title="Billing Interval"
        value={getBillingIntervalLabel()}
        description="Please decide how frequently you will bill clients for regular services. Daily and weekly invoicing will improve your cash flow but it will also increase credit card transaction fees."
        onEdit={() => {
          setEditValue(settings.billingInterval);
          setEditModal("billingInterval");
        }}
      />

      {/* Sales Tax */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Sales Tax</h2>
            <p className="text-sm text-gray-500 mt-1">Sales Tax Calculator Type</p>
            <p className="text-teal-600 font-medium">{settings.salesTaxCalculatorType === "manual" ? "MANUAL CALCULATOR" : "AUTOMATIC (AVALARA)"}</p>
          </div>
          <button
            onClick={() => {
              setEditValue(settings.salesTaxCalculatorType);
              setEditModal("salesTaxType");
            }}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700"
          >
            EDIT
          </button>
        </div>

        {/* Manual Sales Tax Preview */}
        {settings.salesTaxCalculatorType === "manual" && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">MANUAL SALES TAX PREVIEW</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Sales Tax</p>
                <p className="text-teal-600">
                  Service {settings.salesTaxService.toFixed(3)}% - Product {settings.salesTaxProduct.toFixed(3)}%
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditModal("salesTaxRates")}
                  className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700"
                >
                  EDIT
                </button>
                <button className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700">
                  ADD ZONE
                </button>
              </div>
            </div>
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-md flex items-start gap-2">
              <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-orange-800">
                If you have accurately configured your sales tax and are using a manual sales tax calculator, please avoid making changes to this setting. Any modifications will impact all current and future client subscriptions.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Onboarding Price Display */}
      <SettingRow
        title="Onboarding Price Display"
        value={settings.onboardingPriceDisplay === "per_cleanup" ? "PER CLEANUP, PER DEFAULT BILLING INTERVAL" : "PER BILLING INTERVAL ONLY"}
        description="Please decide how to display your pricing on your client onboarding form. If you choose per cleanup, we'll auto-calculate the prices. Your update will be immediately visible to new clients."
        onEdit={() => {
          setEditValue(settings.onboardingPriceDisplay);
          setEditModal("onboardingPriceDisplay");
        }}
      />

      {/* Start of Billing Cycle */}
      <SettingRow
        title="Start of Billing Cycle"
        value={getStartOfBillingCycleLabel()}
        description="Please choose what day of the month you would like to auto-generate invoice draft for your clients. If you would like to set a client's billing cycle to align when that client begins service, please choose Rolling Basis. Your change will only affect new client subscriptions."
        onEdit={() => {
          setEditValue(settings.startOfBillingCycle);
          setEditModal("startOfBillingCycle");
        }}
      />

      {/* Net Terms */}
      <SettingRow
        title="Net Terms"
        value={`NET ${settings.netTerms}`}
        description="Allow your clients extra time to pay for their invoices. If you choose NET10, clients will be charged 10 days after their invoice is created. Your change will only affect new client invoices."
        onEdit={() => {
          setEditValue(String(settings.netTerms));
          setEditModal("netTerms");
        }}
      />

      {/* Email Invoices */}
      <SettingRow
        title="Email Invoices"
        value={settings.emailInvoices ? "YES" : "NO"}
        description="Update if finalized invoices will be emailed to clients."
        onEdit={() => {
          setEditValue(settings.emailInvoices ? "yes" : "no");
          setEditModal("emailInvoices");
        }}
      />

      {/* Invoice Email Note to Clients */}
      <SettingRow
        title="Invoice Email Note to Clients"
        description="Add a custom message to your invoice emails"
        buttons={
          <>
            <button
              onClick={() => {
                setEditEmailBody(settings.invoiceEmailNoteResidential);
                setEditModal("invoiceEmailResidential");
              }}
              className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 whitespace-nowrap"
            >
              CUSTOM RESIDENTIAL NOTE
            </button>
            <button
              onClick={() => {
                setEditEmailBody(settings.invoiceEmailNoteCommercial);
                setEditModal("invoiceEmailCommercial");
              }}
              className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 whitespace-nowrap"
            >
              CUSTOM COMMERCIAL NOTE
            </button>
          </>
        }
      />

      {/* Invoice PDF Note to Clients */}
      <SettingRow
        title="Invoice PDF Note to Clients"
        description="Add a custom message to your invoice PDFs."
        buttons={
          <>
            <button
              onClick={() => {
                setEditPdfNote(settings.invoicePdfNoteResidential);
                setEditModal("invoicePdfResidential");
              }}
              className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 whitespace-nowrap"
            >
              CUSTOM RESIDENTIAL NOTE
            </button>
            <button
              onClick={() => {
                setEditPdfNote(settings.invoicePdfNoteCommercial);
                setEditModal("invoicePdfCommercial");
              }}
              className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 whitespace-nowrap"
            >
              CUSTOM COMMERCIAL NOTE
            </button>
          </>
        }
      />

      {/* Skipped Cleanups */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Skipped Cleanups (Postpaid Clients Only)</h2>
            <p className="text-sm text-gray-500 mt-1">
              Automatically prorate client invoices based on skipped cleanup reason.
              <br />
              Example: 75% for Bad Weather Conditions or 100% for Unsafe Dog.
            </p>
          </div>
          <button
            onClick={() => {
              setEditSkipCosts([...settings.skippedCleanupsResidential]);
              setEditModal("skippedCleanupsResidential");
            }}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700"
          >
            EDIT
          </button>
        </div>

        {/* Residential Clients Table */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">For Residential Clients</h3>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-xs text-gray-500 uppercase tracking-wide py-2">Reason</th>
                <th className="text-left text-xs text-gray-500 uppercase tracking-wide py-2">More Info</th>
                <th className="text-right text-xs text-gray-500 uppercase tracking-wide py-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {settings.skippedCleanupsResidential.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-2 text-sm text-gray-900">{item.reason}</td>
                  <td className="py-2 text-sm text-gray-500">{item.moreInfo}</td>
                  <td className="py-2 text-sm text-gray-900 text-right">{item.cost.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Commercial Clients Table */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">For Commercial Clients</h3>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-xs text-gray-500 uppercase tracking-wide py-2">Reason</th>
                <th className="text-left text-xs text-gray-500 uppercase tracking-wide py-2">More Info</th>
                <th className="text-right text-xs text-gray-500 uppercase tracking-wide py-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {settings.skippedCleanupsCommercial.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-2 text-sm text-gray-900">{item.reason}</td>
                  <td className="py-2 text-sm text-gray-500">{item.moreInfo}</td>
                  <td className="py-2 text-sm text-gray-900 text-right">{item.cost.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modals */}

      {/* Billing Option Modal */}
      <Modal
        isOpen={editModal === "billingOption"}
        onClose={() => setEditModal(null)}
        title="Edit Billing Option"
        onSave={() => saveSettings({ billingOption: editValue as BillingSettings["billingOption"] })}
        saving={saving}
      >
        <RadioSelect
          options={[
            { value: "prepaid_fixed", label: "Prepaid Fixed", description: "Bill before services are performed with fixed amounts" },
            { value: "prepaid_variable", label: "Prepaid Variable", description: "Bill before services are performed with variable amounts" },
            { value: "postpaid", label: "Postpaid", description: "Bill after services are performed" },
          ]}
          value={editValue}
          onChange={setEditValue}
        />
      </Modal>

      {/* Billing Interval Modal */}
      <Modal
        isOpen={editModal === "billingInterval"}
        onClose={() => setEditModal(null)}
        title="Edit Billing Interval"
        onSave={() => saveSettings({ billingInterval: editValue as BillingSettings["billingInterval"] })}
        saving={saving}
      >
        <RadioSelect
          options={[
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "biweekly", label: "Biweekly" },
            { value: "monthly", label: "Monthly" },
          ]}
          value={editValue}
          onChange={setEditValue}
        />
      </Modal>

      {/* Sales Tax Type Modal */}
      <Modal
        isOpen={editModal === "salesTaxType"}
        onClose={() => setEditModal(null)}
        title="Edit Sales Tax Calculator Type"
        onSave={() => saveSettings({ salesTaxCalculatorType: editValue as "manual" | "automatic" })}
        saving={saving}
      >
        <RadioSelect
          options={[
            { value: "manual", label: "Manual Calculator", description: "Manually enter sales tax rates" },
            { value: "automatic", label: "Automatic (Avalara)", description: "Automatically calculate sales tax using Avalara" },
          ]}
          value={editValue}
          onChange={setEditValue}
        />
      </Modal>

      {/* Sales Tax Rates Modal */}
      <Modal
        isOpen={editModal === "salesTaxRates"}
        onClose={() => setEditModal(null)}
        title="Edit Sales Tax Rates"
        onSave={() => saveSettings({
          salesTaxService: parseFloat(editValue.split(",")[0]) || 0,
          salesTaxProduct: parseFloat(editValue.split(",")[1]) || 0,
        })}
        saving={saving}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Service Tax Rate (%)</label>
            <input
              type="number"
              step="0.001"
              value={editValue.split(",")[0] || settings.salesTaxService}
              onChange={(e) => setEditValue(`${e.target.value},${editValue.split(",")[1] || settings.salesTaxProduct}`)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Product Tax Rate (%)</label>
            <input
              type="number"
              step="0.001"
              value={editValue.split(",")[1] || settings.salesTaxProduct}
              onChange={(e) => setEditValue(`${editValue.split(",")[0] || settings.salesTaxService},${e.target.value}`)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </Modal>

      {/* Onboarding Price Display Modal */}
      <Modal
        isOpen={editModal === "onboardingPriceDisplay"}
        onClose={() => setEditModal(null)}
        title="Edit Onboarding Price Display"
        onSave={() => saveSettings({ onboardingPriceDisplay: editValue as "per_cleanup" | "per_interval" })}
        saving={saving}
      >
        <RadioSelect
          options={[
            { value: "per_cleanup", label: "Per Cleanup, Per Default Billing Interval" },
            { value: "per_interval", label: "Per Billing Interval Only" },
          ]}
          value={editValue}
          onChange={setEditValue}
        />
      </Modal>

      {/* Start of Billing Cycle Modal */}
      <Modal
        isOpen={editModal === "startOfBillingCycle"}
        onClose={() => setEditModal(null)}
        title="Edit Start of Billing Cycle"
        onSave={() => saveSettings({ startOfBillingCycle: editValue as "1st" | "15th" | "rolling" })}
        saving={saving}
      >
        <RadioSelect
          options={[
            { value: "1st", label: "1st of the Month" },
            { value: "15th", label: "15th of the Month" },
            { value: "rolling", label: "Rolling Basis" },
          ]}
          value={editValue}
          onChange={setEditValue}
        />
      </Modal>

      {/* Net Terms Modal */}
      <Modal
        isOpen={editModal === "netTerms"}
        onClose={() => setEditModal(null)}
        title="Edit Net Terms"
        onSave={() => saveSettings({ netTerms: parseInt(editValue) || 0 })}
        saving={saving}
      >
        <RadioSelect
          options={[
            { value: "0", label: "NET 0", description: "Due immediately" },
            { value: "7", label: "NET 7", description: "Due in 7 days" },
            { value: "10", label: "NET 10", description: "Due in 10 days" },
            { value: "15", label: "NET 15", description: "Due in 15 days" },
          ]}
          value={editValue}
          onChange={setEditValue}
        />
      </Modal>

      {/* Email Invoices Modal */}
      <Modal
        isOpen={editModal === "emailInvoices"}
        onClose={() => setEditModal(null)}
        title="Edit Email Invoices"
        onSave={() => saveSettings({ emailInvoices: editValue === "yes" })}
        saving={saving}
      >
        <RadioSelect
          options={[
            { value: "yes", label: "Yes", description: "Email finalized invoices to clients" },
            { value: "no", label: "No", description: "Do not email invoices automatically" },
          ]}
          value={editValue}
          onChange={setEditValue}
        />
      </Modal>

      {/* Invoice Email Residential Modal */}
      <Modal
        isOpen={editModal === "invoiceEmailResidential"}
        onClose={() => setEditModal(null)}
        title="Edit Residential Invoice Email Template"
        subtitle="You may edit only a part of the email template in the text area below."
        onSave={() => saveSettings({ invoiceEmailNoteResidential: editEmailBody })}
        saving={saving}
        wide
      >
        <div className="border border-gray-200 rounded-lg p-4 space-y-4">
          <p className="text-gray-700">Invoice from &quot;[Company Name]&quot;</p>
          <p className="text-gray-700">Dear [Client Name],</p>
          <p className="text-gray-700">Please find attached to this email your latest invoice.</p>
          <p className="text-gray-700">You currently have a balance due of $[amount]</p>
          <div>
            <div className="flex justify-end mb-1">
              <button className="text-teal-600 text-sm hover:text-teal-700">Reset to default</button>
            </div>
            <fieldset className="border border-gray-300 rounded-md">
              <legend className="text-sm text-gray-500 px-2 ml-2">Residential Invoice Body</legend>
              <textarea
                value={editEmailBody}
                onChange={(e) => setEditEmailBody(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border-0 focus:outline-none focus:ring-0 resize-none"
              />
            </fieldset>
            <div className="flex justify-between mt-1">
              <p className="text-xs text-gray-500">Please do not use special characters such as ;{"}"}%^& etc. Please do not enter any links.</p>
              <span className="text-xs text-gray-500">{editEmailBody.length}</span>
            </div>
          </div>
          <p className="text-gray-700">Thank you for your business. We appreciate it very much.</p>
        </div>
      </Modal>

      {/* Invoice Email Commercial Modal */}
      <Modal
        isOpen={editModal === "invoiceEmailCommercial"}
        onClose={() => setEditModal(null)}
        title="Edit Commercial Invoice Email Template"
        subtitle="You may edit only a part of the email template in the text area below."
        onSave={() => saveSettings({ invoiceEmailNoteCommercial: editEmailBody })}
        saving={saving}
        wide
      >
        <div className="border border-gray-200 rounded-lg p-4 space-y-4">
          <p className="text-gray-700">Invoice from &quot;[Company Name]&quot;</p>
          <p className="text-gray-700">Dear [Client Name],</p>
          <p className="text-gray-700">Please find attached to this email your latest invoice.</p>
          <p className="text-gray-700">You currently have a balance due of $[amount]</p>
          <div>
            <div className="flex justify-end mb-1">
              <button className="text-teal-600 text-sm hover:text-teal-700">Reset to default</button>
            </div>
            <fieldset className="border border-gray-300 rounded-md">
              <legend className="text-sm text-gray-500 px-2 ml-2">Commercial Invoice Body</legend>
              <textarea
                value={editEmailBody}
                onChange={(e) => setEditEmailBody(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border-0 focus:outline-none focus:ring-0 resize-none"
              />
            </fieldset>
            <div className="flex justify-between mt-1">
              <p className="text-xs text-gray-500">Please do not use special characters such as ;{"}"}%^& etc. Please do not enter any links.</p>
              <span className="text-xs text-gray-500">{editEmailBody.length}</span>
            </div>
          </div>
          <p className="text-gray-700">Thank you for your business. We appreciate it very much.</p>
        </div>
      </Modal>

      {/* Invoice PDF Residential Modal */}
      <Modal
        isOpen={editModal === "invoicePdfResidential"}
        onClose={() => setEditModal(null)}
        title="Edit Footer on Residential PDF Invoice Template"
        subtitle="You may edit or hide the footer within the invoice PDF."
        onSave={() => saveSettings({ invoicePdfNoteResidential: editPdfNote })}
        saving={saving}
        wide
      >
        <div className="border border-gray-200 rounded-lg p-4 space-y-4">
          <label className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditPdfNote({ ...editPdfNote, hideFooter: !editPdfNote.hideFooter })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                editPdfNote.hideFooter ? "bg-teal-600" : "bg-gray-200"
              }`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${editPdfNote.hideFooter ? "translate-x-5" : "translate-x-0"}`} />
            </button>
            <span className="text-gray-700">Hide Footer</span>
          </label>

          <div>
            <div className="flex justify-end mb-1">
              <button className="text-teal-600 text-sm hover:text-teal-700">Reset to default</button>
            </div>
            <fieldset className="border border-gray-300 rounded-md">
              <legend className="text-sm text-gray-500 px-2 ml-2">Footer title</legend>
              <input
                type="text"
                value={editPdfNote.title}
                onChange={(e) => setEditPdfNote({ ...editPdfNote, title: e.target.value })}
                className="w-full px-3 py-2 border-0 focus:outline-none focus:ring-0"
              />
            </fieldset>
            <div className="flex justify-between mt-1">
              <p className="text-xs text-gray-500">Please do not use special characters such as ;{"}"}%^& etc. Please do not enter any links.</p>
              <span className="text-xs text-gray-500">{editPdfNote.title.length}</span>
            </div>
          </div>

          <div>
            <div className="flex justify-end mb-1">
              <button className="text-teal-600 text-sm hover:text-teal-700">Reset to default</button>
            </div>
            <fieldset className="border border-gray-300 rounded-md">
              <legend className="text-sm text-gray-500 px-2 ml-2">Footer content</legend>
              <textarea
                value={editPdfNote.content}
                onChange={(e) => setEditPdfNote({ ...editPdfNote, content: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border-0 focus:outline-none focus:ring-0 resize-none"
              />
            </fieldset>
            <div className="flex justify-between mt-1">
              <p className="text-xs text-gray-500">Please do not use special characters such as ;{"}"}%^& etc. Please do not enter any links.</p>
              <span className="text-xs text-gray-500">{editPdfNote.content.length}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Invoice PDF Commercial Modal */}
      <Modal
        isOpen={editModal === "invoicePdfCommercial"}
        onClose={() => setEditModal(null)}
        title="Edit Footer on Commercial PDF Invoice Template"
        subtitle="You may edit or hide the footer within the invoice PDF."
        onSave={() => saveSettings({ invoicePdfNoteCommercial: editPdfNote })}
        saving={saving}
        wide
      >
        <div className="border border-gray-200 rounded-lg p-4 space-y-4">
          <label className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditPdfNote({ ...editPdfNote, hideFooter: !editPdfNote.hideFooter })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                editPdfNote.hideFooter ? "bg-teal-600" : "bg-gray-200"
              }`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${editPdfNote.hideFooter ? "translate-x-5" : "translate-x-0"}`} />
            </button>
            <span className="text-gray-700">Hide Footer</span>
          </label>

          <div>
            <div className="flex justify-end mb-1">
              <button className="text-teal-600 text-sm hover:text-teal-700">Reset to default</button>
            </div>
            <fieldset className="border border-gray-300 rounded-md">
              <legend className="text-sm text-gray-500 px-2 ml-2">Footer title</legend>
              <input
                type="text"
                value={editPdfNote.title}
                onChange={(e) => setEditPdfNote({ ...editPdfNote, title: e.target.value })}
                className="w-full px-3 py-2 border-0 focus:outline-none focus:ring-0"
              />
            </fieldset>
            <div className="flex justify-between mt-1">
              <p className="text-xs text-gray-500">Please do not use special characters such as ;{"}"}%^& etc. Please do not enter any links.</p>
              <span className="text-xs text-gray-500">{editPdfNote.title.length}</span>
            </div>
          </div>

          <div>
            <div className="flex justify-end mb-1">
              <button className="text-teal-600 text-sm hover:text-teal-700">Reset to default</button>
            </div>
            <fieldset className="border border-gray-300 rounded-md">
              <legend className="text-sm text-gray-500 px-2 ml-2">Footer content</legend>
              <textarea
                value={editPdfNote.content}
                onChange={(e) => setEditPdfNote({ ...editPdfNote, content: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border-0 focus:outline-none focus:ring-0 resize-none"
              />
            </fieldset>
            <div className="flex justify-between mt-1">
              <p className="text-xs text-gray-500">Please do not use special characters such as ;{"}"}%^& etc. Please do not enter any links.</p>
              <span className="text-xs text-gray-500">{editPdfNote.content.length}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Skipped Cleanups Residential Modal */}
      <Modal
        isOpen={editModal === "skippedCleanupsResidential"}
        onClose={() => setEditModal(null)}
        title="Edit Skipped Cleanups Cost"
        onSave={() => saveSettings({ skippedCleanupsResidential: editSkipCosts })}
        saving={saving}
        wide
      >
        <div className="space-y-1">
          <div className="bg-gray-100 px-4 py-3 -mx-6 mb-4">
            <h4 className="font-medium text-gray-900">For Residential Clients</h4>
          </div>
          {editSkipCosts.map((item, idx) => (
            <div key={idx} className="py-3 border-b border-gray-100">
              <label className="block text-sm text-gray-500 mb-1">{item.reason}</label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">%</span>
                <input
                  type="number"
                  step="0.01"
                  value={item.cost}
                  onChange={(e) => {
                    const newCosts = [...editSkipCosts];
                    newCosts[idx] = { ...newCosts[idx], cost: parseFloat(e.target.value) || 0 };
                    setEditSkipCosts(newCosts);
                  }}
                  className="flex-1 px-0 py-1 border-0 border-b border-gray-300 focus:outline-none focus:ring-0 focus:border-teal-500 text-gray-900"
                />
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
