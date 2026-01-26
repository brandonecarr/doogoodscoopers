"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// Type definitions for onboarding settings
interface OnboardingSettings {
  couponCode: { enabled: boolean };
  maxDogs: number;
  cleanupFrequencies: string[];
  lastTimeYardWasCleaned: { enabled: boolean };
  requestFirstNameBeforeQuote: { enabled: boolean };
  requestLastNameBeforeQuote: { enabled: boolean };
  homePhoneNumber: { enabled: boolean };
  cellPhoneNumber: { enabled: boolean; required: boolean };
  requestCellPhoneBeforeQuote: { enabled: boolean };
  requestEmailBeforeQuote: { enabled: boolean };
  dogNames: { enabled: boolean; required: boolean };
  isDogSafe: { enabled: boolean };
  dogBreeds: { enabled: boolean };
  commentsForEachDog: { enabled: boolean };
  gateLocation: { enabled: boolean; required: boolean };
  doggieDoor: { enabled: boolean; required: boolean };
  garbageCanLocation: { enabled: boolean };
  gatedCommunity: { enabled: boolean };
  areasToClean: { enabled: boolean };
  cleanupNotifications: { enabled: boolean; required: boolean };
  notificationType: { enabled: boolean; required: boolean };
  checkPaymentMethod: { enabled: boolean };
  howHeardAboutUs: {
    enabled: boolean;
    required: boolean;
    options: string[];
  };
  partialSubmissionNotification: { enabled: boolean };
  additionalComments: { enabled: boolean };
}

const defaultSettings: OnboardingSettings = {
  couponCode: { enabled: true },
  maxDogs: 4,
  cleanupFrequencies: ["TWO_TIMES_A_WEEK", "ONCE_A_WEEK", "BI_WEEKLY"],
  lastTimeYardWasCleaned: { enabled: true },
  requestFirstNameBeforeQuote: { enabled: true },
  requestLastNameBeforeQuote: { enabled: false },
  homePhoneNumber: { enabled: false },
  cellPhoneNumber: { enabled: true, required: true },
  requestCellPhoneBeforeQuote: { enabled: true },
  requestEmailBeforeQuote: { enabled: false },
  dogNames: { enabled: true, required: true },
  isDogSafe: { enabled: true },
  dogBreeds: { enabled: false },
  commentsForEachDog: { enabled: false },
  gateLocation: { enabled: true, required: true },
  doggieDoor: { enabled: true, required: true },
  garbageCanLocation: { enabled: false },
  gatedCommunity: { enabled: false },
  areasToClean: { enabled: false },
  cleanupNotifications: { enabled: true, required: true },
  notificationType: { enabled: true, required: true },
  checkPaymentMethod: { enabled: false },
  howHeardAboutUs: {
    enabled: true,
    required: true,
    options: [
      "SEARCH_ENGINE",
      "PREVIOUS_CLIENT",
      "REFERRED_BY_FAMILY_OR_FRIEND",
      "FLIER_FROM_BUSINESS",
      "SOCIAL_MEDIA",
      "VEHICLE_SIGNAGE",
      "YARD_SIGN",
      "SALES_REPRESENTATIVE",
      "OTHER",
    ],
  },
  partialSubmissionNotification: { enabled: true },
  additionalComments: { enabled: true },
};

const CLEANUP_FREQUENCIES = [
  { value: "SEVEN_TIMES_A_WEEK", label: "Seven Times A Week" },
  { value: "SIX_TIMES_A_WEEK", label: "Six Times A Week" },
  { value: "FIVE_TIMES_A_WEEK", label: "Five Times A Week" },
  { value: "FOUR_TIMES_A_WEEK", label: "Four Times A Week" },
  { value: "THREE_TIMES_A_WEEK", label: "Three Times A Week" },
  { value: "TWO_TIMES_A_WEEK", label: "Two Times A Week" },
  { value: "ONCE_A_WEEK", label: "Once A Week" },
  { value: "BI_WEEKLY", label: "Bi Weekly" },
  { value: "TWICE_PER_MONTH", label: "Twice Per Month" },
  { value: "EVERY_THREE_WEEKS", label: "Every Three Weeks" },
  { value: "EVERY_FOUR_WEEKS", label: "Every Four Weeks" },
  { value: "ONCE_A_MONTH", label: "Once A Month" },
  { value: "ONE_TIME", label: "One Time" },
];

const HOW_HEARD_OPTIONS = [
  { value: "SEARCH_ENGINE", label: "Search Engine" },
  { value: "PREVIOUS_CLIENT", label: "Previous Client" },
  { value: "REFERRED_BY_FAMILY_OR_FRIEND", label: "Referred By Family Or Friend" },
  { value: "FLIER_FROM_BUSINESS", label: "Flier From Business" },
  { value: "DIRECTORY_LISTING", label: "Directory Listing" },
  { value: "SOCIAL_MEDIA", label: "Social Media" },
  { value: "VEHICLE_SIGNAGE", label: "Vehicle Signage" },
  { value: "YARD_SIGN", label: "Yard Sign" },
  { value: "RADIO_AD", label: "Radio Ad" },
  { value: "LOCAL_EVENT", label: "Local Event" },
  { value: "GIFT_CERTIFICATE", label: "Gift Certificate" },
  { value: "TV_AD", label: "TV Ad" },
  { value: "SALES_REPRESENTATIVE", label: "Sales Representative" },
  { value: "OTHER", label: "Other" },
];

export default function SignupFormSetup() {
  const [settings, setSettings] = useState<OnboardingSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/onboarding-settings");
      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }
      const data = await response.json();
      if (data.settings?.onboarding) {
        setSettings({ ...defaultSettings, ...data.settings.onboarding });
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch("/api/admin/onboarding-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarding: settings }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save settings");
      }

      setSuccessMessage("Settings saved successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof OnboardingSettings>(
    key: K,
    value: OnboardingSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const toggleEnabled = (key: keyof OnboardingSettings) => {
    const current = settings[key];
    if (typeof current === "object" && "enabled" in current) {
      updateSetting(key, { ...current, enabled: !current.enabled } as OnboardingSettings[typeof key]);
    }
  };

  const toggleRequired = (key: keyof OnboardingSettings) => {
    const current = settings[key];
    if (typeof current === "object" && "required" in current) {
      updateSetting(key, { ...current, required: !current.required } as OnboardingSettings[typeof key]);
    }
  };

  const toggleFrequency = (frequency: string) => {
    const current = settings.cleanupFrequencies;
    if (current.includes(frequency)) {
      updateSetting(
        "cleanupFrequencies",
        current.filter((f) => f !== frequency)
      );
    } else {
      updateSetting("cleanupFrequencies", [...current, frequency]);
    }
  };

  const toggleHowHeardOption = (option: string) => {
    const current = settings.howHeardAboutUs.options;
    if (current.includes(option)) {
      updateSetting("howHeardAboutUs", {
        ...settings.howHeardAboutUs,
        options: current.filter((o) => o !== option),
      });
    } else {
      updateSetting("howHeardAboutUs", {
        ...settings.howHeardAboutUs,
        options: [...current, option],
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm text-blue-700">
        Please Click &quot;View In A Browser&quot; To See The Client Onboarding Form And Use The
        Settings Below To Modify The Client Onboarding Process.
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
          {successMessage}
        </div>
      )}

      {/* Settings Form */}
      <div className="space-y-6">
        {/* Coupon Code */}
        <SettingRow
          label="Coupon Code"
          description="If you will use coupons to run special promotions, please make sure to keep the 'Coupon Code' field enabled."
          enabled={settings.couponCode.enabled}
          onToggle={() => toggleEnabled("couponCode")}
          extra={
            <Link href="/app/office/settings/coupons" className="text-teal-600 hover:underline text-sm">
              Manage coupons
            </Link>
          }
        />

        {/* Number Of Dogs */}
        <div className="border-b border-gray-200 pb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900">Number Of Dogs</h3>
              <p className="text-sm text-gray-500 mt-1">
                Maximum number of dogs is 10! Please choose the maximum number of dogs new clients
                can select within the client onboarding form.
              </p>
            </div>
            <select
              value={settings.maxDogs}
              onChange={(e) => updateSetting("maxDogs", parseInt(e.target.value))}
              className="ml-4 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-teal-500 focus:border-teal-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cleanup Frequency */}
        <div className="border-b border-gray-200 pb-6">
          <h3 className="text-sm font-medium text-gray-900">Cleanup Frequency</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Please specify cleanup frequency options new clients can select within the client
            onboarding form.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {CLEANUP_FREQUENCIES.map((freq) => (
              <label key={freq.value} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.cleanupFrequencies.includes(freq.value)}
                  onChange={() => toggleFrequency(freq.value)}
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-gray-700">{freq.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Last Time Yard Was Cleaned Field */}
        <SettingRow
          label="Last Time Yard Was Cleaned Field"
          description="If your initial cleanup estimate does not depend on when a yard was last time cleaned you may disable this field on the onboarding form. If disabled it will be hidden on form and prefilled as One Week."
          enabled={settings.lastTimeYardWasCleaned.enabled}
          onToggle={() => toggleEnabled("lastTimeYardWasCleaned")}
        />

        {/* Request First Name Before Showing Quote */}
        <SettingRow
          label="Request First Name Before Showing Quote"
          description="Collect a prospect's first name before displaying the quote to enable effective remarketing."
          enabled={settings.requestFirstNameBeforeQuote.enabled}
          onToggle={() => toggleEnabled("requestFirstNameBeforeQuote")}
        />

        {/* Request Last Name Before Showing Quote */}
        <SettingRow
          label="Request Last Name Before Showing Quote"
          description="Collect a prospect's last name before displaying the quote to enable effective remarketing."
          enabled={settings.requestLastNameBeforeQuote.enabled}
          onToggle={() => toggleEnabled("requestLastNameBeforeQuote")}
        />

        {/* Home Phone Number */}
        <SettingRow
          label="Home Phone Number"
          enabled={settings.homePhoneNumber.enabled}
          onToggle={() => toggleEnabled("homePhoneNumber")}
        />

        {/* Cell Phone Number */}
        <SettingRowWithRequired
          label="Cell Phone Number"
          enabled={settings.cellPhoneNumber.enabled}
          required={settings.cellPhoneNumber.required}
          onToggle={() => toggleEnabled("cellPhoneNumber")}
          onToggleRequired={() => toggleRequired("cellPhoneNumber")}
        />

        {/* Request Cell Phone Number Before Showing Quote */}
        <SettingRow
          label="Request Cell Phone Number Before Showing Quote"
          description="Collect a prospect's phone number before displaying the quote to enable effective remarketing. Use the mobile phone to follow up with leads who request a quote but don't complete sign-up."
          enabled={settings.requestCellPhoneBeforeQuote.enabled}
          onToggle={() => toggleEnabled("requestCellPhoneBeforeQuote")}
        />

        {/* Request Email Before Showing Quote */}
        <SettingRow
          label="Request Email Before Showing Quote"
          description="Collect a prospect's email before displaying the quote to enable effective remarketing. Use the email to follow up with leads who request a quote but don't complete sign-up."
          enabled={settings.requestEmailBeforeQuote.enabled}
          onToggle={() => toggleEnabled("requestEmailBeforeQuote")}
        />

        {/* Dog Names */}
        <SettingRowWithRequired
          label="Dog Names"
          enabled={settings.dogNames.enabled}
          required={settings.dogNames.required}
          onToggle={() => toggleEnabled("dogNames")}
          onToggleRequired={() => toggleRequired("dogNames")}
        />

        {/* Is Dog Safe */}
        <SettingRow
          label="Is Dog Safe"
          description="Is it safe for us to be in the yard with your dog?"
          enabled={settings.isDogSafe.enabled}
          onToggle={() => toggleEnabled("isDogSafe")}
        />

        {/* Dog Breeds */}
        <SettingRow
          label="Dog Breeds"
          description="This field can be configured only if Dog Names field is enabled."
          enabled={settings.dogBreeds.enabled}
          onToggle={() => toggleEnabled("dogBreeds")}
          disabled={!settings.dogNames.enabled}
        />

        {/* Comments For Each Dog */}
        <SettingRow
          label="Comments For Each Dog"
          enabled={settings.commentsForEachDog.enabled}
          onToggle={() => toggleEnabled("commentsForEachDog")}
        />

        {/* Gate Location */}
        <SettingRowWithRequired
          label="Gate Location"
          enabled={settings.gateLocation.enabled}
          required={settings.gateLocation.required}
          onToggle={() => toggleEnabled("gateLocation")}
          onToggleRequired={() => toggleRequired("gateLocation")}
        />

        {/* Doggie Door */}
        <SettingRowWithRequired
          label="Doggie Door"
          enabled={settings.doggieDoor.enabled}
          required={settings.doggieDoor.required}
          onToggle={() => toggleEnabled("doggieDoor")}
          onToggleRequired={() => toggleRequired("doggieDoor")}
        />

        {/* Garbage Can Location */}
        <SettingRow
          label="Garbage Can Location"
          enabled={settings.garbageCanLocation.enabled}
          onToggle={() => toggleEnabled("garbageCanLocation")}
        />

        {/* Gated Community */}
        <SettingRow
          label="Gated Community"
          enabled={settings.gatedCommunity.enabled}
          onToggle={() => toggleEnabled("gatedCommunity")}
        />

        {/* Areas To Clean */}
        <SettingRow
          label="Areas To Clean"
          description="Let clients choose what areas they would like to be cleaned"
          enabled={settings.areasToClean.enabled}
          onToggle={() => toggleEnabled("areasToClean")}
        />

        {/* Cleanup Notifications */}
        <SettingRowWithRequired
          label="Cleanup Notifications"
          description="Let new clients choose what cleanup notifications they receive."
          enabled={settings.cleanupNotifications.enabled}
          required={settings.cleanupNotifications.required}
          onToggle={() => toggleEnabled("cleanupNotifications")}
          onToggleRequired={() => toggleRequired("cleanupNotifications")}
        />

        {/* Notification Type */}
        <SettingRowWithRequired
          label="Notification Type"
          description="Let new clients specify how they would like to receive cleanup notifications. If disabled, clients will only receive client dashboard notifications."
          enabled={settings.notificationType.enabled}
          required={settings.notificationType.required}
          onToggle={() => toggleEnabled("notificationType")}
          onToggleRequired={() => toggleRequired("notificationType")}
        />

        {/* Check Payment Method */}
        <SettingRow
          label="Check Payment Method"
          description="Let new clients pay by check. If disabled, new clients are required to enter a credit card within the sign up form."
          enabled={settings.checkPaymentMethod.enabled}
          onToggle={() => toggleEnabled("checkPaymentMethod")}
        />

        {/* How Heard About Us */}
        <div className="border-b border-gray-200 pb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900">How Heard About Us</h3>
              <p className="text-sm text-gray-500 mt-1">
                Let clients choose how they heard about you.
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.howHeardAboutUs.required}
                  onChange={() =>
                    updateSetting("howHeardAboutUs", {
                      ...settings.howHeardAboutUs,
                      required: !settings.howHeardAboutUs.required,
                    })
                  }
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-gray-600">Required</span>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {HOW_HEARD_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.howHeardAboutUs.options.includes(option.value)}
                  onChange={() => toggleHowHeardOption(option.value)}
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Enable Client Onboarding Partial Submission Notification */}
        <SettingRow
          label="Enable Client Onboarding Partial Submission Notification"
          description="Partial submission - Receive partial submission notifications via email so you are alerted every time someone requests a quote but does not sign up."
          enabled={settings.partialSubmissionNotification.enabled}
          onToggle={() => toggleEnabled("partialSubmissionNotification")}
        />

        {/* Additional Comments */}
        <SettingRow
          label="Additional Comments"
          enabled={settings.additionalComments.enabled}
          onToggle={() => toggleEnabled("additionalComments")}
        />
      </div>

      {/* Save Button */}
      <div className="pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// Reusable components
interface SettingRowProps {
  label: string;
  description?: string;
  enabled: boolean;
  onToggle: () => void;
  extra?: React.ReactNode;
  disabled?: boolean;
}

function SettingRow({ label, description, enabled, onToggle, extra, disabled }: SettingRowProps) {
  return (
    <div className={`border-b border-gray-200 pb-6 ${disabled ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-900">{label}</h3>
          {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
          {extra && <div className="mt-2">{extra}</div>}
        </div>
        <Toggle enabled={enabled} onToggle={onToggle} disabled={disabled} />
      </div>
    </div>
  );
}

interface SettingRowWithRequiredProps extends SettingRowProps {
  required: boolean;
  onToggleRequired: () => void;
}

function SettingRowWithRequired({
  label,
  description,
  enabled,
  required,
  onToggle,
  onToggleRequired,
}: SettingRowWithRequiredProps) {
  return (
    <div className="border-b border-gray-200 pb-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-900">{label}</h3>
          {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        </div>
        <div className="flex items-center space-x-4">
          <Toggle enabled={enabled} onToggle={onToggle} />
          {enabled && (
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={required}
                onChange={onToggleRequired}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-600">Required</span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

interface ToggleProps {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function Toggle({ enabled, onToggle, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
        enabled ? "bg-teal-600" : "bg-gray-200"
      } ${disabled ? "cursor-not-allowed" : ""}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
