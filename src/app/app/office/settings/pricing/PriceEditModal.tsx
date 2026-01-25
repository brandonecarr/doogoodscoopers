"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface PriceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (prices: { [dogCount: number]: number }) => Promise<void>;
  zone: "REGULAR" | "PREMIUM";
  frequency: string;
  frequencyLabel: string;
  initialPrices: { [dogCount: number]: number };
  maxDogs: number;
}

type ChangeType = "amount" | "percentage";
type ChangeDirection = "increase" | "decrease";

export default function PriceEditModal({
  isOpen,
  onClose,
  onSave,
  zone,
  frequencyLabel,
  initialPrices,
  maxDogs,
}: PriceEditModalProps) {
  const [prices, setPrices] = useState<{ [dogCount: number]: number }>(initialPrices);
  // Track raw input strings to avoid cursor jumping
  const [inputValues, setInputValues] = useState<{ [dogCount: number]: string }>({});
  const [bulkChangeType, setBulkChangeType] = useState<ChangeType>("amount");
  const [bulkDirection, setBulkDirection] = useState<ChangeDirection>("increase");
  const [bulkValue, setBulkValue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset prices when modal opens with new initial values
  useEffect(() => {
    if (isOpen) {
      setPrices(initialPrices);
      setInputValues({}); // Clear raw inputs so they show formatted values
      setBulkValue("");
      setSaveError(null);
    }
  }, [isOpen, initialPrices]);

  const handlePriceChange = (dogCount: number, value: string) => {
    // Store raw input value to prevent cursor jumping
    setInputValues((prev) => ({ ...prev, [dogCount]: value }));
  };

  const handlePriceBlur = (dogCount: number) => {
    const rawValue = inputValues[dogCount];
    if (rawValue !== undefined) {
      // Convert to cents on blur
      const cleanValue = rawValue.replace(/[^\d.]/g, "");
      const dollars = parseFloat(cleanValue) || 0;
      const cents = Math.round(dollars * 100);
      setPrices((prev) => ({ ...prev, [dogCount]: cents }));
      // Clear raw input so it shows formatted value
      setInputValues((prev) => {
        const updated = { ...prev };
        delete updated[dogCount];
        return updated;
      });
    }
  };

  const applyBulkChange = () => {
    const numericValue = parseFloat(bulkValue) || 0;
    if (numericValue === 0) return;

    setPrices((prev) => {
      const updated = { ...prev };
      for (const [dogCountStr, currentCents] of Object.entries(prev)) {
        const dogCount = parseInt(dogCountStr);
        let newCents: number;

        if (bulkChangeType === "percentage") {
          const changeAmount = (currentCents * numericValue) / 100;
          newCents = bulkDirection === "increase"
            ? currentCents + changeAmount
            : currentCents - changeAmount;
        } else {
          // Amount is in dollars, convert to cents
          const changeAmountCents = numericValue * 100;
          newCents = bulkDirection === "increase"
            ? currentCents + changeAmountCents
            : currentCents - changeAmountCents;
        }

        updated[dogCount] = Math.max(0, Math.round(newCents));
      }
      return updated;
    });
    setInputValues({}); // Clear raw inputs to show new formatted values
    setBulkValue("");
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // Convert any pending input values before saving
      const finalPrices = { ...prices };
      for (const [dogCountStr, rawValue] of Object.entries(inputValues)) {
        const dogCount = parseInt(dogCountStr);
        const cleanValue = rawValue.replace(/[^\d.]/g, "");
        const dollars = parseFloat(cleanValue) || 0;
        finalPrices[dogCount] = Math.round(dollars * 100);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {zone === "PREMIUM" ? "Premium" : "Regular"} - {frequencyLabel}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Bulk Price Edit */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Bulk Price Edit Setup
            </h4>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Change By
                </label>
                <select
                  value={bulkChangeType}
                  onChange={(e) => setBulkChangeType(e.target.value as ChangeType)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="amount">Amount</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Direction
                </label>
                <select
                  value={bulkDirection}
                  onChange={(e) => setBulkDirection(e.target.value as ChangeDirection)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="increase">Increase</option>
                  <option value="decrease">Decrease</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Value
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  placeholder={bulkChangeType === "amount" ? "$0.00" : "%"}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={applyBulkChange}
                  disabled={!bulkValue}
                  className="w-full px-3 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* Individual Prices */}
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {Array.from({ length: maxDogs }, (_, i) => i + 1).map((dogCount) => (
              <div key={dogCount} className="flex items-center gap-4">
                <label className="w-20 text-sm text-gray-700">
                  {dogCount} dog{dogCount > 1 ? "s" : ""}
                </label>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <input
                    type="text"
                    value={inputValues[dogCount] !== undefined ? inputValues[dogCount] : formatDollars(prices[dogCount] || 0)}
                    onChange={(e) => handlePriceChange(dogCount, e.target.value)}
                    onBlur={() => handlePriceBlur(dogCount)}
                    className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {saveError && (
          <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {saveError}
          </div>
        )}

        {/* Footer */}
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
