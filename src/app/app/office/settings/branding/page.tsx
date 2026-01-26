"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

interface CompanyInfo {
  businessName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  businessEmail: string;
  businessPhone: string;
  website: string;
}

interface BrandingSettings {
  logoOnboardingForm: string | null;
  logoClientPortal: string | null;
  brandingColorOnboarding: string;
  brandingColorClientPortal: string;
  headerBackgroundColor: string;
}

interface GoogleAnalyticsSettings {
  ga4MeasurementId: string | null;
}

interface BrandingData {
  companyInfo: CompanyInfo;
  branding: BrandingSettings;
  googleAnalytics: GoogleAnalyticsSettings;
}

// Color swatch component
function ColorSwatch({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-6 h-6 rounded border border-gray-300"
        style={{ backgroundColor: color }}
      />
      <span className="text-gray-900">{color}</span>
    </div>
  );
}

// Edit Modal Component
function EditModal({
  isOpen,
  onClose,
  title,
  children,
  onSave,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/50"
          onClick={onClose}
        />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4">
            {children}
          </div>
          <div className="flex justify-end gap-3 p-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Form field components
function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
    />
  );
}

function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#000000"
        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent uppercase"
      />
    </div>
  );
}

export default function BrandingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<BrandingData>({
    companyInfo: {
      businessName: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      zipCode: "",
      country: "United States",
      businessEmail: "",
      businessPhone: "",
      website: "",
    },
    branding: {
      logoOnboardingForm: null,
      logoClientPortal: null,
      brandingColorOnboarding: "#9CD5CF",
      brandingColorClientPortal: "#5499A7",
      headerBackgroundColor: "#9CD5CF",
    },
    googleAnalytics: {
      ga4MeasurementId: null,
    },
  });

  // Modal states
  const [editCompanyInfo, setEditCompanyInfo] = useState(false);
  const [editBranding, setEditBranding] = useState(false);
  const [editGoogleAnalytics, setEditGoogleAnalytics] = useState(false);

  // Edit form states
  const [editedCompanyInfo, setEditedCompanyInfo] = useState<CompanyInfo>(data.companyInfo);
  const [editedBranding, setEditedBranding] = useState<BrandingSettings>(data.branding);
  const [editedGoogleAnalytics, setEditedGoogleAnalytics] = useState<GoogleAnalyticsSettings>(data.googleAnalytics);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const result = await res.json();
        const settings = result.settings || {};
        const branding = settings.branding || {};

        setData({
          companyInfo: branding.companyInfo || {
            businessName: result.orgName || "",
            addressLine1: "",
            addressLine2: "",
            city: "",
            state: "",
            zipCode: "",
            country: "United States",
            businessEmail: "",
            businessPhone: "",
            website: "",
          },
          branding: branding.branding || {
            logoOnboardingForm: null,
            logoClientPortal: null,
            brandingColorOnboarding: "#9CD5CF",
            brandingColorClientPortal: "#5499A7",
            headerBackgroundColor: "#9CD5CF",
          },
          googleAnalytics: branding.googleAnalytics || {
            ga4MeasurementId: null,
          },
        });
      }
    } catch (error) {
      console.error("Error fetching branding settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update edited states when data changes
  useEffect(() => {
    setEditedCompanyInfo(data.companyInfo);
    setEditedBranding(data.branding);
    setEditedGoogleAnalytics(data.googleAnalytics);
  }, [data]);

  const saveSettings = async (section: "companyInfo" | "branding" | "googleAnalytics", newData: unknown) => {
    setSaving(true);
    try {
      const currentBranding = {
        companyInfo: data.companyInfo,
        branding: data.branding,
        googleAnalytics: data.googleAnalytics,
      };

      const updatedBranding = {
        ...currentBranding,
        [section]: newData,
      };

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: { branding: updatedBranding },
        }),
      });

      if (res.ok) {
        setData(updatedBranding);
        return true;
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setSaving(false);
    }
    return false;
  };

  const handleSaveCompanyInfo = async () => {
    const success = await saveSettings("companyInfo", editedCompanyInfo);
    if (success) setEditCompanyInfo(false);
  };

  const handleSaveBranding = async () => {
    const success = await saveSettings("branding", editedBranding);
    if (success) setEditBranding(false);
  };

  const handleSaveGoogleAnalytics = async () => {
    const success = await saveSettings("googleAnalytics", editedGoogleAnalytics);
    if (success) setEditGoogleAnalytics(false);
  };

  const formatAddress = () => {
    const { addressLine1, addressLine2, city, state, zipCode, country } = data.companyInfo;
    const lines = [];
    if (addressLine1) lines.push(addressLine1);
    if (addressLine2) lines.push(addressLine2);
    if (city || state || zipCode) {
      lines.push(`${city}${city && state ? ", " : ""}${state}${(city || state) && zipCode ? ", " : ""}${zipCode}`);
    }
    if (country) lines.push(country);
    return lines;
  };

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} - ${digits.slice(6)}`;
    }
    return phone;
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
        <span className="text-gray-400">BRANDING</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Branding</h1>
      </div>

      {/* Company Info Section */}
      <section className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Company Info</h2>
          <button
            onClick={() => setEditCompanyInfo(true)}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700"
          >
            EDIT
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">BUSINESS NAME</p>
            <p className="text-gray-900 font-medium">{data.companyInfo.businessName || "No data"}</p>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">BUSINESS ADDRESS</p>
            {formatAddress().length > 0 ? (
              formatAddress().map((line, i) => (
                <p key={i} className="text-gray-900">{line}</p>
              ))
            ) : (
              <p className="text-gray-400">No data</p>
            )}
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">BUSINESS EMAIL</p>
            <p className="text-gray-900">{data.companyInfo.businessEmail || <span className="text-gray-400">No data</span>}</p>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">BUSINESS PHONE</p>
            <p className="text-gray-900">
              {data.companyInfo.businessPhone ? formatPhone(data.companyInfo.businessPhone) : <span className="text-gray-400">No data</span>}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">WEBSITE</p>
            {data.companyInfo.website ? (
              <a
                href={data.companyInfo.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-600 hover:text-teal-700"
              >
                {data.companyInfo.website}
              </a>
            ) : (
              <p className="text-gray-400">No data</p>
            )}
          </div>
        </div>
      </section>

      {/* Branding Section */}
      <section className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Branding</h2>
          <button
            onClick={() => setEditBranding(true)}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700"
          >
            EDIT
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">LOGO ON CLIENT ONBOARDING FORM</p>
            {data.branding.logoOnboardingForm ? (
              <Image
                src={data.branding.logoOnboardingForm}
                alt="Onboarding Logo"
                width={200}
                height={60}
                className="object-contain"
              />
            ) : (
              <p className="text-gray-400">No data</p>
            )}
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">LOGO ON CLIENT PORTAL</p>
            {data.branding.logoClientPortal ? (
              <Image
                src={data.branding.logoClientPortal}
                alt="Client Portal Logo"
                width={200}
                height={60}
                className="object-contain"
              />
            ) : (
              <p className="text-gray-400">No data</p>
            )}
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">BRANDING COLOR ON CLIENT ONBOARDING FORM</p>
            <ColorSwatch color={data.branding.brandingColorOnboarding} />
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">BRANDING COLOR ON CLIENT PORTAL</p>
            <ColorSwatch color={data.branding.brandingColorClientPortal} />
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">HEADER BACKGROUND COLOR</p>
            <ColorSwatch color={data.branding.headerBackgroundColor} />
          </div>
        </div>
      </section>

      {/* Google Analytics Section */}
      <section className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Google Analytics</h2>
          <button
            onClick={() => setEditGoogleAnalytics(true)}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700"
          >
            EDIT
          </button>
        </div>
        <div className="p-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">GOOGLE ANALYTICS (GA4) MEASUREMENT ID</p>
            <p className="text-gray-900">
              {data.googleAnalytics.ga4MeasurementId || <span className="text-gray-400">No data</span>}
            </p>
          </div>
        </div>
      </section>

      {/* Edit Company Info Modal */}
      <EditModal
        isOpen={editCompanyInfo}
        onClose={() => setEditCompanyInfo(false)}
        title="Edit Company Info"
        onSave={handleSaveCompanyInfo}
        saving={saving}
      >
        <div className="space-y-4">
          <FormField label="Business Name">
            <TextInput
              value={editedCompanyInfo.businessName}
              onChange={(v) => setEditedCompanyInfo({ ...editedCompanyInfo, businessName: v })}
            />
          </FormField>
          <FormField label="Address Line 1">
            <TextInput
              value={editedCompanyInfo.addressLine1}
              onChange={(v) => setEditedCompanyInfo({ ...editedCompanyInfo, addressLine1: v })}
            />
          </FormField>
          <FormField label="Address Line 2">
            <TextInput
              value={editedCompanyInfo.addressLine2}
              onChange={(v) => setEditedCompanyInfo({ ...editedCompanyInfo, addressLine2: v })}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="City">
              <TextInput
                value={editedCompanyInfo.city}
                onChange={(v) => setEditedCompanyInfo({ ...editedCompanyInfo, city: v })}
              />
            </FormField>
            <FormField label="State">
              <TextInput
                value={editedCompanyInfo.state}
                onChange={(v) => setEditedCompanyInfo({ ...editedCompanyInfo, state: v })}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="ZIP Code">
              <TextInput
                value={editedCompanyInfo.zipCode}
                onChange={(v) => setEditedCompanyInfo({ ...editedCompanyInfo, zipCode: v })}
              />
            </FormField>
            <FormField label="Country">
              <TextInput
                value={editedCompanyInfo.country}
                onChange={(v) => setEditedCompanyInfo({ ...editedCompanyInfo, country: v })}
              />
            </FormField>
          </div>
          <FormField label="Business Email">
            <TextInput
              type="email"
              value={editedCompanyInfo.businessEmail}
              onChange={(v) => setEditedCompanyInfo({ ...editedCompanyInfo, businessEmail: v })}
            />
          </FormField>
          <FormField label="Business Phone">
            <TextInput
              type="tel"
              value={editedCompanyInfo.businessPhone}
              onChange={(v) => setEditedCompanyInfo({ ...editedCompanyInfo, businessPhone: v })}
            />
          </FormField>
          <FormField label="Website">
            <TextInput
              type="url"
              value={editedCompanyInfo.website}
              onChange={(v) => setEditedCompanyInfo({ ...editedCompanyInfo, website: v })}
              placeholder="https://example.com"
            />
          </FormField>
        </div>
      </EditModal>

      {/* Edit Branding Modal */}
      <EditModal
        isOpen={editBranding}
        onClose={() => setEditBranding(false)}
        title="Edit Branding"
        onSave={handleSaveBranding}
        saving={saving}
      >
        <div className="space-y-4">
          <FormField label="Logo on Client Onboarding Form (URL)">
            <TextInput
              value={editedBranding.logoOnboardingForm || ""}
              onChange={(v) => setEditedBranding({ ...editedBranding, logoOnboardingForm: v || null })}
              placeholder="https://example.com/logo.png"
            />
          </FormField>
          <FormField label="Logo on Client Portal (URL)">
            <TextInput
              value={editedBranding.logoClientPortal || ""}
              onChange={(v) => setEditedBranding({ ...editedBranding, logoClientPortal: v || null })}
              placeholder="https://example.com/logo.png"
            />
          </FormField>
          <FormField label="Branding Color on Client Onboarding Form">
            <ColorInput
              value={editedBranding.brandingColorOnboarding}
              onChange={(v) => setEditedBranding({ ...editedBranding, brandingColorOnboarding: v })}
            />
          </FormField>
          <FormField label="Branding Color on Client Portal">
            <ColorInput
              value={editedBranding.brandingColorClientPortal}
              onChange={(v) => setEditedBranding({ ...editedBranding, brandingColorClientPortal: v })}
            />
          </FormField>
          <FormField label="Header Background Color">
            <ColorInput
              value={editedBranding.headerBackgroundColor}
              onChange={(v) => setEditedBranding({ ...editedBranding, headerBackgroundColor: v })}
            />
          </FormField>
        </div>
      </EditModal>

      {/* Edit Google Analytics Modal */}
      <EditModal
        isOpen={editGoogleAnalytics}
        onClose={() => setEditGoogleAnalytics(false)}
        title="Edit Google Analytics"
        onSave={handleSaveGoogleAnalytics}
        saving={saving}
      >
        <FormField label="Google Analytics (GA4) Measurement ID">
          <TextInput
            value={editedGoogleAnalytics.ga4MeasurementId || ""}
            onChange={(v) => setEditedGoogleAnalytics({ ...editedGoogleAnalytics, ga4MeasurementId: v || null })}
            placeholder="G-XXXXXXXXXX"
          />
        </FormField>
      </EditModal>
    </div>
  );
}
