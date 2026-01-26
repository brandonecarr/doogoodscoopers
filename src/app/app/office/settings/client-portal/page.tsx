"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, Copy, Check } from "lucide-react";

interface ClientPortalSettings {
  showCompanyAddress: boolean;
  showPhoneNumber: boolean;
  clientCanText: boolean;
  clientCanCall: boolean;
  showEmailAddress: boolean;
}

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

const DEFAULT_SETTINGS: ClientPortalSettings = {
  showCompanyAddress: true,
  showPhoneNumber: true,
  clientCanText: true,
  clientCanCall: true,
  showEmailAddress: true,
};

// Toggle Switch Component
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
        checked ? "bg-teal-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// Checkbox Component
function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
            checked ? "bg-teal-600" : "bg-white border-2 border-gray-300"
          }`}
        >
          {checked && (
            <svg
              className="w-3.5 h-3.5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

// Dropdown Button Component
function DropdownButton({
  label,
  onViewInBrowser,
  onCopyLink,
  copied,
}: {
  label: string;
  onViewInBrowser: () => void;
  onCopyLink: () => void;
  copied: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        {label}
        <ChevronDown className="w-4 h-4" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
            <button
              onClick={() => {
                onViewInBrowser();
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
            >
              <ExternalLink className="w-4 h-4" />
              View in a browser
            </button>
            <button
              onClick={() => {
                onCopyLink();
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              Copy the link
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function ClientPortalSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ClientPortalSettings>(DEFAULT_SETTINGS);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [orgSlug, setOrgSlug] = useState<string>("");
  const [copiedOnboarding, setCopiedOnboarding] = useState(false);
  const [copiedLogin, setCopiedLogin] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<ClientPortalSettings>(DEFAULT_SETTINGS);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        const clientPortalSettings = data.settings?.clientPortal || DEFAULT_SETTINGS;
        const brandingInfo = data.settings?.branding?.companyInfo || null;

        setSettings(clientPortalSettings);
        setOriginalSettings(clientPortalSettings);
        setCompanyInfo(brandingInfo);

        // Get org slug for links
        const orgRes = await fetch("/api/admin/organization");
        if (orgRes.ok) {
          const orgData = await orgRes.json();
          setOrgSlug(orgData.slug || orgData.id || "");
        }
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(changed);
  }, [settings, originalSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: { clientPortal: settings },
        }),
      });

      if (res.ok) {
        setOriginalSettings(settings);
        setHasChanges(false);
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const getOnboardingLink = () => {
    if (typeof window !== "undefined" && orgSlug) {
      return `${window.location.origin}/onboarding/${orgSlug}`;
    }
    return "";
  };

  const getLoginLink = () => {
    if (typeof window !== "undefined" && orgSlug) {
      return `${window.location.origin}/portal/${orgSlug}`;
    }
    return "";
  };

  const handleViewOnboarding = () => {
    const link = getOnboardingLink();
    if (link) window.open(link, "_blank");
  };

  const handleCopyOnboarding = async () => {
    const link = getOnboardingLink();
    if (link) {
      await navigator.clipboard.writeText(link);
      setCopiedOnboarding(true);
      setTimeout(() => setCopiedOnboarding(false), 2000);
    }
  };

  const handleViewLogin = () => {
    const link = getLoginLink();
    if (link) window.open(link, "_blank");
  };

  const handleCopyLogin = async () => {
    const link = getLoginLink();
    if (link) {
      await navigator.clipboard.writeText(link);
      setCopiedLogin(true);
      setTimeout(() => setCopiedLogin(false), 2000);
    }
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
        <span className="text-gray-400">CLIENT PORTAL</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Client Portal</h1>
        <div className="flex items-center gap-3">
          <DropdownButton
            label="CLIENT ONBOARDING"
            onViewInBrowser={handleViewOnboarding}
            onCopyLink={handleCopyOnboarding}
            copied={copiedOnboarding}
          />
          <DropdownButton
            label="CLIENT LOGIN"
            onViewInBrowser={handleViewLogin}
            onCopyLink={handleCopyLogin}
            copied={copiedLogin}
          />
        </div>
      </div>

      {/* Client Dashboard Section */}
      <section className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Client Dashboard</h2>
        </div>
        <div className="p-6 space-y-8">
          {/* Show Company Address */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">Show Company Address</span>
              <Toggle
                checked={settings.showCompanyAddress}
                onChange={(checked) => setSettings({ ...settings, showCompanyAddress: checked })}
              />
            </div>
            <p className="text-sm text-gray-500">
              Let clients see your address on the client portal dashboard. Example: If you accept check payments via regular mail.
            </p>
            <Link
              href="/app/office/settings/branding"
              className="text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              Edit Company Address
            </Link>
          </div>

          {/* Show Phone Number */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">Show Phone Number</span>
              <Toggle
                checked={settings.showPhoneNumber}
                onChange={(checked) => setSettings({ ...settings, showPhoneNumber: checked })}
              />
            </div>
            <p className="text-sm text-gray-500">
              Let clients see your contact phone number on the client portal dashboard.
            </p>
            <Link
              href="/app/office/settings/branding"
              className="text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              Edit Phone Number
            </Link>
            {settings.showPhoneNumber && (
              <div className="space-y-3 pt-2">
                <Checkbox
                  label="Client can text the number"
                  checked={settings.clientCanText}
                  onChange={(checked) => setSettings({ ...settings, clientCanText: checked })}
                />
                <Checkbox
                  label="Client can call the number"
                  checked={settings.clientCanCall}
                  onChange={(checked) => setSettings({ ...settings, clientCanCall: checked })}
                />
              </div>
            )}
          </div>

          {/* Show Email Address */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">Show Email Address</span>
              <Toggle
                checked={settings.showEmailAddress}
                onChange={(checked) => setSettings({ ...settings, showEmailAddress: checked })}
              />
            </div>
            <p className="text-sm text-gray-500">
              Let clients see your contact email on the client portal dashboard.
            </p>
            <Link
              href="/app/office/settings/branding"
              className="text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              Edit Email
            </Link>
          </div>
        </div>

        {/* Save Button */}
        <div className="px-6 pb-6">
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "SAVING..." : "SAVE CHANGES"}
          </button>
        </div>
      </section>
    </div>
  );
}
