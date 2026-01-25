"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Building,
  Palette,
  Bell,
  MapPin,
  Clock,
  Save,
  RefreshCw,
  Check,
  AlertCircle,
  Image,
  Mail,
  Phone,
} from "lucide-react";

interface OrganizationSettings {
  // Branding
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;

  // Contact Info
  businessEmail?: string;
  businessPhone?: string;
  businessAddress?: string;

  // Onboarding Settings
  onboardingAbandonmentMinutes?: number;
  defaultFrequency?: string;
  requirePhoneNumber?: boolean;
  showDogBreedField?: boolean;

  // Notification Defaults
  defaultSmsEnabled?: boolean;
  defaultEmailEnabled?: boolean;
  sendOnTheWayNotification?: boolean;
  sendCompletionNotification?: boolean;

  // Service Settings
  serviceStartHour?: number;
  serviceEndHour?: number;
  bufferMinutesBetweenJobs?: number;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [settings, setSettings] = useState<OrganizationSettings>({});
  const [activeTab, setActiveTab] = useState("general");

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();

      if (res.ok) {
        setOrgName(data.orgName || "");
        setSettings(data.settings || {});
      } else {
        setError(data.error || "Failed to load settings");
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });

      const data = await res.json();

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.error || "Failed to save settings");
      }
    } catch (err) {
      console.error("Error saving settings:", err);
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  const updateSetting = <K extends keyof OrganizationSettings>(
    key: K,
    value: OrganizationSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const tabs = [
    { id: "general", label: "General", icon: Building },
    { id: "branding", label: "Branding", icon: Palette },
    { id: "onboarding", label: "Onboarding", icon: Clock },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "service", label: "Service", icon: MapPin },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Configure system preferences</p>
        </div>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-gray-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Configure system preferences for {orgName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSettings}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Saving...
              </>
            ) : saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-teal-500 text-teal-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* General Tab */}
          {activeTab === "general" && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Business Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={settings.businessEmail || ""}
                        onChange={(e) => updateSetting("businessEmail", e.target.value)}
                        placeholder="contact@yourbusiness.com"
                        className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Used for customer communications and notifications</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business Phone
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        value={settings.businessPhone || ""}
                        onChange={(e) => updateSetting("businessPhone", e.target.value)}
                        placeholder="(555) 123-4567"
                        className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business Address
                    </label>
                    <textarea
                      value={settings.businessAddress || ""}
                      onChange={(e) => updateSetting("businessAddress", e.target.value)}
                      placeholder="123 Main St, City, State ZIP"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Branding Tab */}
          {activeTab === "branding" && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Brand Customization</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Logo URL
                    </label>
                    <div className="relative">
                      <Image className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="url"
                        value={settings.logoUrl || ""}
                        onChange={(e) => updateSetting("logoUrl", e.target.value)}
                        placeholder="https://example.com/logo.png"
                        className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Used in emails and client portal</p>
                  </div>

                  {settings.logoUrl && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-2">Logo Preview:</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={settings.logoUrl}
                        alt="Logo preview"
                        className="max-h-16 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Primary Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings.primaryColor || "#0d9488"}
                          onChange={(e) => updateSetting("primaryColor", e.target.value)}
                          className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={settings.primaryColor || "#0d9488"}
                          onChange={(e) => updateSetting("primaryColor", e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Secondary Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings.secondaryColor || "#14b8a6"}
                          onChange={(e) => updateSetting("secondaryColor", e.target.value)}
                          className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={settings.secondaryColor || "#14b8a6"}
                          onChange={(e) => updateSetting("secondaryColor", e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-3">Color Preview:</p>
                    <div className="flex gap-4">
                      <div
                        className="w-24 h-10 rounded-lg shadow-sm"
                        style={{ backgroundColor: settings.primaryColor || "#0d9488" }}
                      />
                      <div
                        className="w-24 h-10 rounded-lg shadow-sm"
                        style={{ backgroundColor: settings.secondaryColor || "#14b8a6" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Onboarding Tab */}
          {activeTab === "onboarding" && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Quote Form Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Abandonment Timeout (minutes)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={120}
                      value={settings.onboardingAbandonmentMinutes || 30}
                      onChange={(e) => updateSetting("onboardingAbandonmentMinutes", parseInt(e.target.value))}
                      className="w-32 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Mark sessions as abandoned after this many minutes of inactivity
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Service Frequency
                    </label>
                    <select
                      value={settings.defaultFrequency || "WEEKLY"}
                      onChange={(e) => updateSetting("defaultFrequency", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                      <option value="WEEKLY">Weekly</option>
                      <option value="BIWEEKLY">Bi-Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="ONETIME">One-Time</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">Pre-selected option on the quote form</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">Require Phone Number</p>
                        <p className="text-sm text-gray-500">Make phone number a required field</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateSetting("requirePhoneNumber", !settings.requirePhoneNumber)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          settings.requirePhoneNumber ? "bg-teal-600" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            settings.requirePhoneNumber ? "translate-x-5" : ""
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">Show Dog Breed Field</p>
                        <p className="text-sm text-gray-500">Ask for dog breed during signup</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateSetting("showDogBreedField", !settings.showDogBreedField)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          settings.showDogBreedField ? "bg-teal-600" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            settings.showDogBreedField ? "translate-x-5" : ""
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Default Notification Preferences</h3>
                <p className="text-sm text-gray-500 mb-4">
                  These are the default preferences for new customers. Customers can change their own preferences.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">SMS Notifications</p>
                      <p className="text-sm text-gray-500">Enable SMS by default for new customers</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateSetting("defaultSmsEnabled", !settings.defaultSmsEnabled)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        settings.defaultSmsEnabled !== false ? "bg-teal-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          settings.defaultSmsEnabled !== false ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Email Notifications</p>
                      <p className="text-sm text-gray-500">Enable email by default for new customers</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateSetting("defaultEmailEnabled", !settings.defaultEmailEnabled)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        settings.defaultEmailEnabled !== false ? "bg-teal-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          settings.defaultEmailEnabled !== false ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">&ldquo;On The Way&rdquo; Notification</p>
                      <p className="text-sm text-gray-500">Send notification when technician is en route</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateSetting("sendOnTheWayNotification", !settings.sendOnTheWayNotification)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        settings.sendOnTheWayNotification !== false ? "bg-teal-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          settings.sendOnTheWayNotification !== false ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Completion Notification</p>
                      <p className="text-sm text-gray-500">Send notification when service is complete</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateSetting("sendCompletionNotification", !settings.sendCompletionNotification)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        settings.sendCompletionNotification !== false ? "bg-teal-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          settings.sendCompletionNotification !== false ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Service Tab */}
          {activeTab === "service" && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Service Window</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Service Start Time
                    </label>
                    <select
                      value={settings.serviceStartHour ?? 8}
                      onChange={(e) => updateSetting("serviceStartHour", parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 6).map((hour) => (
                        <option key={hour} value={hour}>
                          {hour <= 12 ? hour : hour - 12}:00 {hour < 12 ? "AM" : "PM"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Service End Time
                    </label>
                    <select
                      value={settings.serviceEndHour ?? 17}
                      onChange={(e) => updateSetting("serviceEndHour", parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 12).map((hour) => (
                        <option key={hour} value={hour}>
                          {hour <= 12 ? hour : hour - 12}:00 {hour < 12 ? "AM" : "PM"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buffer Between Jobs (minutes)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={5}
                  value={settings.bufferMinutesBetweenJobs ?? 5}
                  onChange={(e) => updateSetting("bufferMinutesBetweenJobs", parseInt(e.target.value))}
                  className="w-32 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Minimum time between scheduled jobs for travel
                </p>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">Service Area Restrictions</p>
                    <p className="text-sm text-blue-700 mt-1">
                      To manage which ZIP codes you serve and restrict certain frequencies by area,
                      use the Zip Guard feature in the menu.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
