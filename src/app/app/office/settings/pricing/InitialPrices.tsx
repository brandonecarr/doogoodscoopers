"use client";

import { useState, useEffect, useCallback } from "react";
import { Pencil, HelpCircle } from "lucide-react";

// Time periods for "last cleaned" options
const TIME_PERIODS = [
  { key: "ONE_WEEK", label: "One Week" },
  { key: "TWO_WEEKS", label: "Two Weeks" },
  { key: "THREE_WEEKS", label: "Three Weeks" },
  { key: "ONE_MONTH", label: "One Month" },
  { key: "TWO_MONTHS", label: "Two Months" },
  { key: "THREE_TO_FOUR_MONTHS", label: "3-4 Months" },
  { key: "FIVE_TO_SIX_MONTHS", label: "5-6 Months" },
  { key: "SEVEN_TO_NINE_MONTHS", label: "7-9 Months" },
  { key: "TEN_PLUS_MONTHS", label: "10+ Months" },
] as const;

type TimePeriodKey = typeof TIME_PERIODS[number]["key"];

interface PriceRange {
  min: number;
  max: number;
}

interface OneTimePriceRow {
  [dogCount: number]: PriceRange;
}

interface OneTimePrices {
  [timePeriod: string]: OneTimePriceRow;
}

interface InitialCleanupSettings {
  useCustomPrices: boolean;
  title: string;
  description: string;
  createInvoiceDrafts: boolean;
}

interface OneTimeSettings {
  useCustomPrices: boolean;
}

interface OneTimePriceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (prices: OneTimePriceRow) => Promise<void>;
  timePeriod: string;
  timePeriodLabel: string;
  initialPrices: OneTimePriceRow;
  maxDogs: number;
}

function OneTimePriceEditModal({
  isOpen,
  onClose,
  onSave,
  timePeriodLabel,
  initialPrices,
  maxDogs,
}: OneTimePriceEditModalProps) {
  const [prices, setPrices] = useState<OneTimePriceRow>(initialPrices);
  const [inputValues, setInputValues] = useState<{ [key: string]: string }>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPrices(initialPrices);
      setInputValues({});
      setSaveError(null);
    }
  }, [isOpen, initialPrices]);

  const handlePriceChange = (dogCount: number, field: "min" | "max", value: string) => {
    const key = `${dogCount}_${field}`;
    setInputValues((prev) => ({ ...prev, [key]: value }));
  };

  const handlePriceBlur = (dogCount: number, field: "min" | "max") => {
    const key = `${dogCount}_${field}`;
    const rawValue = inputValues[key];
    if (rawValue !== undefined) {
      const cleanValue = rawValue.replace(/[^\d.]/g, "");
      const dollars = parseFloat(cleanValue) || 0;
      const cents = Math.round(dollars * 100);
      setPrices((prev) => ({
        ...prev,
        [dogCount]: {
          ...prev[dogCount],
          [field]: cents,
        },
      }));
      setInputValues((prev) => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // Convert any pending input values before saving
      const finalPrices = { ...prices };
      for (const [key, rawValue] of Object.entries(inputValues)) {
        const [dogCountStr, field] = key.split("_");
        const dogCount = parseInt(dogCountStr);
        const cleanValue = rawValue.replace(/[^\d.]/g, "");
        const dollars = parseFloat(cleanValue) || 0;
        const cents = Math.round(dollars * 100);
        finalPrices[dogCount] = {
          ...finalPrices[dogCount],
          [field]: cents,
        };
      }
      await onSave(finalPrices);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save prices");
    } finally {
      setSaving(false);
    }
  };

  const formatDollars = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  const getInputValue = (dogCount: number, field: "min" | "max") => {
    const key = `${dogCount}_${field}`;
    if (inputValues[key] !== undefined) {
      return inputValues[key];
    }
    return formatDollars(prices[dogCount]?.[field] || 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            One-Time Cleanup - {timePeriodLabel}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-96 overflow-y-auto">
          <p className="text-sm text-gray-600">
            Set the minimum and maximum price range for each dog count.
          </p>

          {Array.from({ length: maxDogs }, (_, i) => i + 1).map((dogCount) => (
            <div key={dogCount} className="flex items-center gap-4">
              <label className="w-20 text-sm text-gray-700 font-medium">
                {dogCount} dog{dogCount > 1 ? "s" : ""}
              </label>
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="text"
                    value={getInputValue(dogCount, "min")}
                    onChange={(e) => handlePriceChange(dogCount, "min", e.target.value)}
                    onBlur={() => handlePriceBlur(dogCount, "min")}
                    className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="0.00"
                  />
                </div>
                <span className="text-gray-400">-</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="text"
                    value={getInputValue(dogCount, "max")}
                    onChange={(e) => handlePriceChange(dogCount, "max", e.target.value)}
                    onBlur={() => handlePriceBlur(dogCount, "max")}
                    className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {saveError && (
          <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {saveError}
          </div>
        )}

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InitialPrices() {
  const [maxDogs, setMaxDogs] = useState(4);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial Cleanup Settings
  const [initialSettings, setInitialSettings] = useState<InitialCleanupSettings>({
    useCustomPrices: false,
    title: "",
    description: "",
    createInvoiceDrafts: false,
  });

  // One-Time Cleanup Settings
  const [oneTimeSettings, setOneTimeSettings] = useState<OneTimeSettings>({
    useCustomPrices: false,
  });

  // One-Time Prices by time period
  const [oneTimePrices, setOneTimePrices] = useState<OneTimePrices>({});

  // Edit modal state
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    timePeriod: TimePeriodKey;
    timePeriodLabel: string;
    prices: OneTimePriceRow;
  } | null>(null);

  const createDefaultPriceRow = useCallback((maxDogs: number): OneTimePriceRow => {
    const row: OneTimePriceRow = {};
    for (let i = 1; i <= maxDogs; i++) {
      row[i] = { min: 0, max: 0 };
    }
    return row;
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch onboarding settings for max dogs and initial cleanup settings
      const settingsResponse = await fetch("/api/admin/onboarding-settings");

      let settingsMaxDogs = 4;
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        settingsMaxDogs = settingsData.settings?.onboarding?.maxDogs || 4;

        // Load initial cleanup settings
        const pricingSettings = settingsData.settings?.pricing || {};
        setInitialSettings({
          useCustomPrices: pricingSettings.initialCleanup?.useCustomPrices || false,
          title: pricingSettings.initialCleanup?.title || "",
          description: pricingSettings.initialCleanup?.description || "",
          createInvoiceDrafts: pricingSettings.initialCleanup?.createInvoiceDrafts || false,
        });
        setOneTimeSettings({
          useCustomPrices: pricingSettings.oneTime?.useCustomPrices || false,
        });

        // Load one-time prices
        const savedOneTimePrices = pricingSettings.oneTimePrices || {};
        const prices: OneTimePrices = {};
        for (const period of TIME_PERIODS) {
          prices[period.key] = savedOneTimePrices[period.key] || createDefaultPriceRow(settingsMaxDogs);
        }
        setOneTimePrices(prices);
      } else {
        // Initialize with defaults
        const prices: OneTimePrices = {};
        for (const period of TIME_PERIODS) {
          prices[period.key] = createDefaultPriceRow(settingsMaxDogs);
        }
        setOneTimePrices(prices);
      }

      setMaxDogs(settingsMaxDogs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [createDefaultPriceRow]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveInitialSettings = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/onboarding-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pricing: {
            initialCleanup: initialSettings,
            oneTime: oneTimeSettings,
            oneTimePrices,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleEditOneTime = (timePeriod: TimePeriodKey, label: string) => {
    setEditModal({
      isOpen: true,
      timePeriod,
      timePeriodLabel: label,
      prices: oneTimePrices[timePeriod] || createDefaultPriceRow(maxDogs),
    });
  };

  const handleSaveOneTimePrices = async (prices: OneTimePriceRow) => {
    if (!editModal) return;

    const updatedPrices = {
      ...oneTimePrices,
      [editModal.timePeriod]: prices,
    };
    setOneTimePrices(updatedPrices);

    // Save to server
    try {
      const response = await fetch("/api/admin/onboarding-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pricing: {
            initialCleanup: initialSettings,
            oneTime: oneTimeSettings,
            oneTimePrices: updatedPrices,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save prices");
      }

      setEditModal(null);
    } catch (err) {
      throw err;
    }
  };

  const formatPriceRange = (priceRow: OneTimePriceRow | undefined, dogCount: number) => {
    if (!priceRow || !priceRow[dogCount]) {
      return "$0.00 - $0.00";
    }
    const { min, max } = priceRow[dogCount];
    return `$${(min / 100).toFixed(2)} - $${(max / 100).toFixed(2)}`;
  };

  const dogCounts = Array.from({ length: maxDogs }, (_, i) => i + 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Initial Cleanup Prices */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Initial Cleanup Prices</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-600">Use custom initial prices</span>
            <button
              type="button"
              onClick={() => setInitialSettings(prev => ({ ...prev, useCustomPrices: !prev.useCustomPrices }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                initialSettings.useCustomPrices ? "bg-teal-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  initialSettings.useCustomPrices ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </label>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Please explain in words your initial cleanup pricing details which will then be displayed within the pricing section of the client onboarding form.
        </p>

        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <button className="text-gray-400 hover:text-gray-600">
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={initialSettings.title}
              onChange={(e) => setInitialSettings(prev => ({ ...prev, title: e.target.value.slice(0, 70) }))}
              placeholder="$99 Initial Cleaning Fee:"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Recommended number of characters is 70 max. <span className="float-right">{initialSettings.title.length} / 70</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Description</label>
            <textarea
              value={initialSettings.description}
              onChange={(e) => setInitialSettings(prev => ({ ...prev, description: e.target.value.slice(0, 200) }))}
              placeholder="Initial fee is billed one-time at $99 for up to 90 minutes of cleaning."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Recommended number of characters is 200 max. <span className="float-right">{initialSettings.description.length} / 200</span>
            </p>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 text-sm text-blue-700">
            Leave the fields blank to hide Initial cleanup pricing section within the client onboarding form.
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <button
              type="button"
              onClick={() => setInitialSettings(prev => ({ ...prev, createInvoiceDrafts: !prev.createInvoiceDrafts }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                initialSettings.createInvoiceDrafts ? "bg-teal-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  initialSettings.createInvoiceDrafts ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-sm text-gray-700">Create initial invoice drafts</span>
          </label>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-sm text-yellow-800">
            If this option is disabled, any initial cleanup tips won&apos;t be automatically applied to the initial cleanup invoice draft and you&apos;ll only be able to charge the tip manually.
          </div>

          <button
            onClick={handleSaveInitialSettings}
            disabled={saving}
            className="px-6 py-2 bg-teal-600 text-white font-medium rounded-md hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "SAVE"}
          </button>
        </div>
      </section>

      {/* One-Time Cleanup Prices */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">One-Time Cleanup Prices</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-600">Use custom one-time prices</span>
            <button
              type="button"
              onClick={() => setOneTimeSettings(prev => ({ ...prev, useCustomPrices: !prev.useCustomPrices }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                oneTimeSettings.useCustomPrices ? "bg-teal-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  oneTimeSettings.useCustomPrices ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </label>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Please enter estimated price of one time cleanup and give your client an exact quote after your field tech sees the yard. One time cleanup estimate is based on the number of dogs and last time a yard was cleaned.
        </p>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500"></th>
                {dogCounts.map((count) => (
                  <th key={count} className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                    {count} dog{count > 1 ? "s" : ""}
                  </th>
                ))}
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {TIME_PERIODS.map((period) => (
                <tr key={period.key} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">{period.label}</td>
                  {dogCounts.map((count) => (
                    <td key={count} className="py-3 px-4 text-sm text-gray-600">
                      {formatPriceRange(oneTimePrices[period.key], count)}
                    </td>
                  ))}
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleEditOneTime(period.key, period.label)}
                      className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 text-sm font-medium"
                    >
                      Edit
                      <Pencil className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <OneTimePriceEditModal
          isOpen={editModal.isOpen}
          onClose={() => setEditModal(null)}
          onSave={handleSaveOneTimePrices}
          timePeriod={editModal.timePeriod}
          timePeriodLabel={editModal.timePeriodLabel}
          initialPrices={editModal.prices}
          maxDogs={maxDogs}
        />
      )}
    </div>
  );
}
