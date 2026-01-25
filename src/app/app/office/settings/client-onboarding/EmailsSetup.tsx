"use client";

import { useState, useEffect, useCallback } from "react";

interface EmailSettings {
  replyToName: string;
  replyToEmail: string;
  autosendLoginInfo: boolean;
}

const defaultSettings: EmailSettings = {
  replyToName: "DooGoodScoopers",
  replyToEmail: "service@doogoodscoopers.com",
  autosendLoginInfo: true,
};

export default function EmailsSetup() {
  const [settings, setSettings] = useState<EmailSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/onboarding-settings");
      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }
      const data = await response.json();
      const emailSettings = data.settings?.emailSettings || defaultSettings;

      setSettings(emailSettings);
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
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/admin/onboarding-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailSettings: settings }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      setSuccessMessage("Email settings saved successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
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
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-700">
          {successMessage}
        </div>
      )}

      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
          GENERAL EMAIL SETTINGS
        </h3>

        <div className="space-y-6">
          {/* Reply To Name */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <label className="text-sm font-medium text-gray-700 pt-2">
              Reply To Name
            </label>
            <div className="md:col-span-2">
              <input
                type="text"
                value={settings.replyToName}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, replyToName: e.target.value }))
                }
                placeholder="Your Business Name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                If longer than 20 characters, try to list the most important words at the beginning.
              </p>
            </div>
          </div>

          {/* Reply To Email Address */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <label className="text-sm font-medium text-gray-700 pt-2">
              Reply To Email Address
            </label>
            <div className="md:col-span-2">
              <input
                type="email"
                value={settings.replyToEmail}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, replyToEmail: e.target.value }))
                }
                placeholder="service@yourdomain.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Try to list an email which you check at least once every 4 business hours.
              </p>
            </div>
          </div>

          {/* Autosend Login Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <label className="text-sm font-medium text-gray-700">
              Autosend Login Info To New Clients
            </label>
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    autosendLoginInfo: !prev.autosendLoginInfo,
                  }))
                }
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                  settings.autosendLoginInfo ? "bg-teal-600" : "bg-gray-200"
                }`}
                role="switch"
                aria-checked={settings.autosendLoginInfo}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.autosendLoginInfo ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
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
      </section>
    </div>
  );
}
