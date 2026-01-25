"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Trash2, Plus, HelpCircle, X } from "lucide-react";

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

// Tooltip component with form diagram
function FormDiagramTooltip({
  isOpen,
  onClose,
  highlightArea,
  anchorRef
}: {
  isOpen: boolean;
  onClose: () => void;
  highlightArea: "callout" | "pricing-disclaimers" | "advertising-disclaimers" | "special-promo";
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={tooltipRef}
      className="absolute z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-72"
      style={{ top: "100%", right: 0, marginTop: "8px" }}
    >
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
      >
        <X className="w-4 h-4" />
      </button>

      <p className="text-xs text-gray-600 mb-3 pr-4">
        {highlightArea === "callout" && "Callout text appears at the top of the pricing section."}
        {highlightArea === "pricing-disclaimers" && "Pricing disclaimers appear below the pricing display."}
        {highlightArea === "advertising-disclaimers" && "Advertising disclaimers appear below the phone number field."}
        {highlightArea === "special-promo" && "Special promo appears under the pricing section."}
      </p>

      {/* Form Diagram SVG */}
      <svg viewBox="0 0 200 280" className="w-full h-auto border border-gray-200 rounded-md bg-gray-50">
        {/* Form Container */}
        <rect x="10" y="10" width="180" height="260" rx="4" fill="white" stroke="#e5e7eb" strokeWidth="1" />

        {/* Header */}
        <rect x="20" y="20" width="160" height="20" rx="2" fill="#f3f4f6" />
        <text x="100" y="34" textAnchor="middle" fontSize="8" fill="#6b7280">Service Details</text>

        {/* Dogs & Frequency */}
        <rect x="20" y="50" width="75" height="15" rx="2" fill="#e5e7eb" />
        <rect x="105" y="50" width="75" height="15" rx="2" fill="#e5e7eb" />

        {/* Last Cleaned */}
        <rect x="20" y="75" width="160" height="15" rx="2" fill="#e5e7eb" />

        {/* Contact Fields - First Name, Phone */}
        <rect x="20" y="100" width="75" height="15" rx="2" fill="#e5e7eb" />
        <rect x="105" y="100" width="75" height="15" rx="2" fill="#e5e7eb" />

        {/* Advertising Disclaimers Area */}
        <rect
          x="20"
          y="120"
          width="160"
          height="18"
          rx="2"
          fill={highlightArea === "advertising-disclaimers" ? "#fef3c7" : "#f9fafb"}
          stroke={highlightArea === "advertising-disclaimers" ? "#f59e0b" : "#e5e7eb"}
          strokeWidth={highlightArea === "advertising-disclaimers" ? "2" : "1"}
        />
        {highlightArea === "advertising-disclaimers" && (
          <text x="100" y="132" textAnchor="middle" fontSize="6" fill="#92400e" fontWeight="bold">ADVERTISING DISCLAIMERS</text>
        )}

        {/* Pricing Section Header */}
        <rect x="20" y="148" width="160" height="15" rx="2" fill="#f3f4f6" />
        <text x="100" y="159" textAnchor="middle" fontSize="7" fill="#6b7280">Your Quote</text>

        {/* Callout Area */}
        <rect
          x="20"
          y="168"
          width="160"
          height="20"
          rx="2"
          fill={highlightArea === "callout" ? "#fef3c7" : "#f9fafb"}
          stroke={highlightArea === "callout" ? "#f59e0b" : "#e5e7eb"}
          strokeWidth={highlightArea === "callout" ? "2" : "1"}
        />
        {highlightArea === "callout" && (
          <text x="100" y="181" textAnchor="middle" fontSize="6" fill="#92400e" fontWeight="bold">CALLOUT TEXT</text>
        )}

        {/* Price Display */}
        <rect x="60" y="193" width="80" height="25" rx="2" fill="#e5e7eb" />
        <text x="100" y="209" textAnchor="middle" fontSize="10" fill="#374151" fontWeight="bold">$XX/visit</text>

        {/* Pricing Disclaimers Area */}
        <rect
          x="20"
          y="223"
          width="160"
          height="15"
          rx="2"
          fill={highlightArea === "pricing-disclaimers" ? "#fef3c7" : "#f9fafb"}
          stroke={highlightArea === "pricing-disclaimers" ? "#f59e0b" : "#e5e7eb"}
          strokeWidth={highlightArea === "pricing-disclaimers" ? "2" : "1"}
        />
        {highlightArea === "pricing-disclaimers" && (
          <text x="100" y="233" textAnchor="middle" fontSize="6" fill="#92400e" fontWeight="bold">PRICING DISCLAIMERS</text>
        )}

        {/* Special Promo Area */}
        <rect
          x="20"
          y="243"
          width="160"
          height="20"
          rx="2"
          fill={highlightArea === "special-promo" ? "#fef3c7" : "#f9fafb"}
          stroke={highlightArea === "special-promo" ? "#f59e0b" : "#e5e7eb"}
          strokeWidth={highlightArea === "special-promo" ? "2" : "1"}
        />
        {highlightArea === "special-promo" && (
          <text x="100" y="256" textAnchor="middle" fontSize="6" fill="#92400e" fontWeight="bold">SPECIAL PROMO</text>
        )}
      </svg>
    </div>
  );
}

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

  // Tooltip state
  const [activeTooltip, setActiveTooltip] = useState<"callout" | "pricing-disclaimers" | "advertising-disclaimers" | "special-promo" | null>(null);
  const calloutHelpRef = useRef<HTMLButtonElement>(null);
  const pricingHelpRef = useRef<HTMLButtonElement>(null);
  const advertisingHelpRef = useRef<HTMLButtonElement>(null);
  const specialPromoHelpRef = useRef<HTMLButtonElement>(null);

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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Callout</h3>

        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2 relative">
              <label className="text-sm font-medium text-gray-700">Callout</label>
              <button
                ref={calloutHelpRef}
                type="button"
                onClick={() => setActiveTooltip(activeTooltip === "callout" ? null : "callout")}
                className="text-gray-400 hover:text-gray-600"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              <FormDiagramTooltip
                isOpen={activeTooltip === "callout"}
                onClose={() => setActiveTooltip(null)}
                highlightArea="callout"
                anchorRef={calloutHelpRef}
              />
            </div>
            <textarea
              value={calloutText}
              onChange={(e) => setCalloutText(e.target.value)}
              placeholder="Enter callout text..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 resize-none"
            />
            <p className="mt-1 text-sm text-gray-500 italic">
              Leave field blank if you don&apos;t want to show callout on the onboarding form.
            </p>
          </div>

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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing Disclaimers</h3>

        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2 relative">
              <label className="text-sm font-medium text-gray-700">Pricing Disclaimers</label>
              <button
                ref={pricingHelpRef}
                type="button"
                onClick={() => setActiveTooltip(activeTooltip === "pricing-disclaimers" ? null : "pricing-disclaimers")}
                className="text-gray-400 hover:text-gray-600"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              <FormDiagramTooltip
                isOpen={activeTooltip === "pricing-disclaimers"}
                onClose={() => setActiveTooltip(null)}
                highlightArea="pricing-disclaimers"
                anchorRef={pricingHelpRef}
              />
            </div>
            <textarea
              value={pricingDisclaimers}
              onChange={(e) => setPricingDisclaimers(e.target.value)}
              placeholder="Enter pricing disclaimers text..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 resize-none"
            />
            <p className="mt-1 text-sm text-gray-500 italic">
              Leave field blank if you don&apos;t want to show pricing disclaimers on the onboarding form.
            </p>
          </div>

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
        <div className="flex items-center gap-2 mb-4 relative">
          <h3 className="text-lg font-semibold text-gray-900">Advertising Disclaimers</h3>
          <button
            ref={advertisingHelpRef}
            type="button"
            onClick={() => setActiveTooltip(activeTooltip === "advertising-disclaimers" ? null : "advertising-disclaimers")}
            className="text-gray-400 hover:text-gray-600"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <FormDiagramTooltip
            isOpen={activeTooltip === "advertising-disclaimers"}
            onClose={() => setActiveTooltip(null)}
            highlightArea="advertising-disclaimers"
            anchorRef={advertisingHelpRef}
          />
        </div>

        <div className="space-y-4">
          {advertisingDisclaimers.length === 0 ? (
            <p className="text-sm text-gray-500">There are no advertising disclaimers</p>
          ) : (
            <div className="space-y-3">
              {advertisingDisclaimers.map((disclaimer, index) => (
                <div key={disclaimer.id}>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Advertising Disclaimer {index + 1}
                  </label>
                  <div className="flex items-start gap-3">
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
        <div className="flex items-center gap-2 mb-4 relative">
          <h3 className="text-lg font-semibold text-gray-900">Special Promo</h3>
          <button
            ref={specialPromoHelpRef}
            type="button"
            onClick={() => setActiveTooltip(activeTooltip === "special-promo" ? null : "special-promo")}
            className="text-gray-400 hover:text-gray-600"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <FormDiagramTooltip
            isOpen={activeTooltip === "special-promo"}
            onClose={() => setActiveTooltip(null)}
            highlightArea="special-promo"
            anchorRef={specialPromoHelpRef}
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Special Promo Title</label>
            <input
              type="text"
              value={specialPromo.title}
              onChange={(e) => setSpecialPromo({ ...specialPromo, title: e.target.value })}
              placeholder="Enter special promo title..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Example: Free Deodorizer for 3 Months!
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Special Promo Description</label>
            <textarea
              value={specialPromo.description}
              onChange={(e) => setSpecialPromo({ ...specialPromo, description: e.target.value })}
              placeholder="Enter special promo description..."
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
