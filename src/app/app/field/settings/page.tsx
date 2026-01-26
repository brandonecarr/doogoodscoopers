"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { FieldContentCard } from "@/components/portals/field/FieldContentCard";

type MapProvider = "apple" | "waze" | "google" | "smarttruck";

const mapOptions: { value: MapProvider; label: string }[] = [
  { value: "apple", label: "Apple Map" },
  { value: "waze", label: "Waze Map" },
  { value: "google", label: "Google Map" },
  { value: "smarttruck", label: "Smart Truck Route" },
];

export default function SettingsPage() {
  const [defaultMap, setDefaultMap] = useState<MapProvider>("apple");
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load saved preference from localStorage
  useEffect(() => {
    const savedMap = localStorage.getItem("fieldTechDefaultMap") as MapProvider;
    if (savedMap && mapOptions.some((opt) => opt.value === savedMap)) {
      setDefaultMap(savedMap);
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    // Save to localStorage
    localStorage.setItem("fieldTechDefaultMap", defaultMap);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const selectedLabel = mapOptions.find((opt) => opt.value === defaultMap)?.label || "Select";

  return (
    <FieldContentCard className="mt-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 -mx-4 -mt-4 px-4 py-4 rounded-t-xl mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-600 mt-1">Select Your Default Map Settings</p>
      </div>

      <div className="space-y-6">
        {/* Default Map Selector */}
        <div className="relative">
          <label className="block text-sm text-teal-600 mb-1">Default Map</label>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between py-2 border-b-2 border-teal-500 text-left"
          >
            <span className="text-gray-900">{selectedLabel}</span>
            <ChevronDown
              className={`w-5 h-5 text-gray-500 transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Dropdown */}
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              <div className="py-1">
                <div className="px-4 py-2 text-sm text-teal-600 bg-gray-50">
                  Default Map
                </div>
                <div className="px-4 py-2 text-sm text-gray-900 bg-teal-50 border-l-4 border-teal-500">
                  {selectedLabel}
                </div>
              </div>
              <div className="border-t border-gray-100">
                {mapOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setDefaultMap(option.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 ${
                      option.value === defaultMap
                        ? "text-teal-600 font-medium"
                        : "text-gray-700"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "SAVING..." : saved ? "SAVED!" : "SAVE SETTINGS"}
        </button>
      </div>
    </FieldContentCard>
  );
}
