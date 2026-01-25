"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, Plus, HelpCircle } from "lucide-react";

// Type definitions for callout and disclaimers settings
interface AdvertisingDisclaimer {
  id: string;
  text: string;
}

interface SpecialPromo {
  title: string;
  description: string;
  autoPreselected: boolean;
}

interface CalloutDisclaimersSettings {
  calloutText: string;
  pricingDisclaimers: string;
  advertisingDisclaimers: AdvertisingDisclaimer[];
  specialPromo: SpecialPromo;
}

const defaultSettings: CalloutDisclaimersSettings = {
  calloutText: "",
  pricingDisclaimers: "",
  advertisingDisclaimers: [],
  specialPromo: {
    title: "",
    description: "",
    autoPreselected: false,
  },
};

export default function CalloutDisclaimersSetup() {
  const [settings, setSettings] = useState<CalloutDisclaimersSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local state for each section (to enable individual save buttons)
  const [calloutText, setCalloutText] = useState("");
  const [pricingDisclaimers, setPricingDisclaimers] = useState("");
  const [advertisingDisclaimers, setAdvertisingDisclaimers] = useState<AdvertisingDisclaimer[]>([]);
  const [specialPromo, setSpecialPromo] = useState<SpecialPromo>(defaultSettings.specialPromo);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/onboarding-settings");
      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }
      const data = await response.json();
      const calloutSettings = data.settings?.calloutDisclaimers || defaultSettings;

      setSettings(calloutSettings);
      setCalloutText(calloutSettings.calloutText || "");
      setPricingDisclaimers(calloutSettings.pricingDisclaimers || "");
      setAdvertisingDisclaimers(calloutSettings.advertisingDisclaimers || []);
      setSpecialPromo(calloutSettings.specialPromo || defaultSettings.specialPromo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSection = async (section: string, data: Partial<CalloutDisclaimersSettings>) => {
    setSaving(section);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedSettings = { ...settings, ...data };

      const response = await fetch("/api/admin/onboarding-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calloutDisclaimers: updatedSettings }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      setSettings(updatedSettings);
      setSuccessMessage(`${section} saved successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(null);
    }
  };

  const addAdvertisingDisclaimer = () => {
    const newDisclaimer: AdvertisingDisclaimer = {
      id: crypto.randomUUID(),
      text: "",
    };
    setAdvertisingDisclaimers([...advertisingDisclaimers, newDisclaimer]);
  };

  const updateAdvertisingDisclaimer = (id: string, text: string) => {
    setAdvertisingDisclaimers(
      advertisingDisclaimers.map((d) => (d.id === id ? { ...d, text } : d))
    );
  };

  const removeAdvertisingDisclaimer = (id: string) => {
    setAdvertisingDisclaimers(advertisingDisclaimers.filter((d) => d.id !== id));
  };

  const clearSpecialPromo = () => {
    setSpecialPromo({
      title: "",
      description: "",
      autoPreselected: false,
    });
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

      {/* Callout Section */}
      <section className="border-b border-gray-200 pb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Callout</h3>
        <p className="text-sm text-gray-600 mb-4">
          Callout text will be displayed at the top of the Pricing section on the Client Onboarding Form
        </p>

        <div className="space-y-4">
          <div className="relative">
            <textarea
              value={calloutText}
              onChange={(e) => setCalloutText(e.target.value)}
              placeholder="Enter callout text..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 resize-none"
            />
            <button
              type="button"
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              title="Help"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-gray-500 italic">
            Leave field blank if you don&apos;t want to show callout on the onboarding form.
          </p>

          <button
            onClick={() => saveSection("Callout", { calloutText })}
            disabled={saving === "Callout"}
            className="px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving === "Callout" ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </section>

      {/* Pricing Disclaimers Section */}
      <section className="border-b border-gray-200 pb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Pricing Disclaimers</h3>
        <p className="text-sm text-gray-600 mb-4">
          Pricing disclaimers text will be displayed at the bottom of the Pricing section on the Client Onboarding Form
        </p>

        <div className="space-y-4">
          <div className="relative">
            <textarea
              value={pricingDisclaimers}
              onChange={(e) => setPricingDisclaimers(e.target.value)}
              placeholder="Enter pricing disclaimers text..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 resize-none"
            />
            <button
              type="button"
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              title="Help"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-gray-500 italic">
            Leave field blank if you don&apos;t want to show pricing disclaimers on the onboarding form.
          </p>

          <button
            onClick={() => saveSection("Pricing Disclaimers", { pricingDisclaimers })}
            disabled={saving === "Pricing Disclaimers"}
            className="px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving === "Pricing Disclaimers" ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </section>

      {/* Advertising Disclaimers Section */}
      <section className="border-b border-gray-200 pb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Advertising Disclaimers</h3>
        <p className="text-sm text-gray-600 mb-4">
          Advertising disclaimers text will be displayed below the Cell phone number on the Client Onboarding Form
        </p>

        <div className="space-y-4">
          {advertisingDisclaimers.length === 0 ? (
            <p className="text-sm text-gray-500">There are no advertising disclaimers</p>
          ) : (
            <div className="space-y-3">
              {advertisingDisclaimers.map((disclaimer) => (
                <div key={disclaimer.id} className="flex items-start gap-3">
                  <textarea
                    value={disclaimer.text}
                    onChange={(e) => updateAdvertisingDisclaimer(disclaimer.id, e.target.value)}
                    placeholder="Enter disclaimer text..."
                    rows={2}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 resize-none text-sm"
                  />
                  <button
                    onClick={() => removeAdvertisingDisclaimer(disclaimer.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-md"
                    title="Remove disclaimer"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              onClick={addAdvertisingDisclaimer}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700"
            >
              <Plus className="w-4 h-4" />
              ADD ADVERTISING DISCLAIMER
            </button>

            {advertisingDisclaimers.length > 0 && (
              <button
                onClick={() => saveSection("Advertising Disclaimers", { advertisingDisclaimers })}
                disabled={saving === "Advertising Disclaimers"}
                className="px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving === "Advertising Disclaimers" ? "Saving..." : "Save Changes"}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Special Promo Section */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Special Promo</h3>
        <p className="text-sm text-gray-600 mb-4">
          Special promo will be displayed under the Pricing section on the Client Onboarding Form
        </p>

        <div className="space-y-4">
          <div>
            <div className="relative">
              <input
                type="text"
                value={specialPromo.title}
                onChange={(e) => setSpecialPromo({ ...specialPromo, title: e.target.value })}
                placeholder="Special Promo Title"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Help"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Example: Free Deodorizer for 3 Months!
            </p>
          </div>

          <div>
            <textarea
              value={specialPromo.description}
              onChange={(e) => setSpecialPromo({ ...specialPromo, description: e.target.value })}
              placeholder="Special Promo Description"
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 resize-none"
            />
            <p className="mt-1 text-sm text-gray-500">
              Example: Sign Up and Get Free Deodorizer for 3 Months - Applied Monthly - New Clients Only! $15 Value per Application
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoPreselected"
              checked={specialPromo.autoPreselected}
              onChange={(e) => setSpecialPromo({ ...specialPromo, autoPreselected: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            <label htmlFor="autoPreselected" className="text-sm text-gray-700">
              Automatically preselected
            </label>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={clearSpecialPromo}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
            >
              Clear Special Promo Form
            </button>

            <button
              onClick={() => saveSection("Special Promo", { specialPromo })}
              disabled={saving === "Special Promo"}
              className="px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving === "Special Promo" ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
