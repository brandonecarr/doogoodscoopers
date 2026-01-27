"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Sparkles,
  Calendar,
  Clock,
  Bell,
  AlertCircle,
  Save,
  Loader2,
  ChevronLeft,
} from "lucide-react";

interface RouteOptimizationSettings {
  daysOff: string[];
  enableContinuousMonitoring: boolean;
  autoAcceptThreshold: number;
  preferredAnalysisTime: string;
  maxSuggestionsPerDay: number;
}

const DEFAULT_SETTINGS: RouteOptimizationSettings = {
  daysOff: ["SUNDAY"],
  enableContinuousMonitoring: false,
  autoAcceptThreshold: 0,
  preferredAnalysisTime: "02:00",
  maxSuggestionsPerDay: 10,
};

const DAYS_OF_WEEK = [
  { value: "SUNDAY", label: "Sunday" },
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
];

export default function RouteOptimizationSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<RouteOptimizationSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();

      if (res.ok && data.settings) {
        // Extract routeOptimization section from org settings
        const routeOptSettings = data.settings.routeOptimization || {};
        setSettings({
          ...DEFAULT_SETTINGS,
          ...routeOptSettings,
        });
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            routeOptimization: settings,
          },
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save settings");
      }
    } catch (err) {
      console.error("Error saving settings:", err);
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const toggleDayOff = (day: string) => {
    setSettings((prev) => ({
      ...prev,
      daysOff: prev.daysOff.includes(day)
        ? prev.daysOff.filter((d) => d !== day)
        : [...prev.daysOff, day],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/app/office/settings"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-600" />
              Route Optimization
            </h1>
            <p className="text-gray-600">
              Configure AI-powered route optimization settings
            </p>
          </div>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 text-green-700 rounded-lg">
          <Save className="w-5 h-5 flex-shrink-0" />
          Settings saved successfully
        </div>
      )}

      {/* Days Off */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Calendar className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Days Off</h2>
            <p className="text-sm text-gray-500 mt-1">
              Select days when no routes should be scheduled. The AI will not
              suggest placing clients on these days.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day.value}
              onClick={() => toggleDayOff(day.value)}
              className={`px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                settings.daysOff.includes(day.value)
                  ? "border-purple-600 bg-purple-50 text-purple-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      </section>

      {/* Continuous Monitoring */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Continuous Monitoring
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Enable automatic route analysis to receive optimization
                suggestions without manually running analysis.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enableContinuousMonitoring}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  enableContinuousMonitoring: e.target.checked,
                }))
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {settings.enableContinuousMonitoring && (
          <div className="mt-4 pl-13 ml-13">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preferred Analysis Time
                </label>
                <input
                  type="time"
                  value={settings.preferredAnalysisTime}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      preferredAnalysisTime: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  When should the AI analyze your routes?
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Suggestions Per Day
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.maxSuggestionsPerDay}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      maxSuggestionsPerDay: parseInt(e.target.value) || 10,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Limit how many suggestions are generated per analysis
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Auto-Accept Threshold */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">
              Auto-Accept Threshold
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Automatically accept suggestions that save more than this many
              minutes per week. Set to 0 to require manual approval for all
              suggestions.
            </p>

            <div className="mt-4">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={30}
                  value={settings.autoAcceptThreshold}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      autoAcceptThreshold: parseInt(e.target.value),
                    }))
                  }
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                />
                <span className="w-24 text-center font-medium text-gray-900">
                  {settings.autoAcceptThreshold === 0
                    ? "Manual only"
                    : `${settings.autoAcceptThreshold} min`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Quick Links</h3>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/app/office/route-planner"
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            New Client Planner
          </Link>
          <Link
            href="/app/office/route-planner/suggestions"
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            View Suggestions
          </Link>
        </div>
      </section>
    </div>
  );
}
