"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type RatingsMode = "disabled" | "ratings_only" | "all";

interface RatingsSettings {
  mode: RatingsMode;
  showToFieldTech: boolean;
  tipAmounts: number[];
}

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

// Radio Option Component
function RadioOption({
  value,
  currentValue,
  onChange,
  label,
  description,
}: {
  value: RatingsMode;
  currentValue: RatingsMode;
  onChange: (value: RatingsMode) => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="radio"
        name="ratingsMode"
        value={value}
        checked={currentValue === value}
        onChange={() => onChange(value)}
        className="mt-1 h-4 w-4 text-teal-600 border-gray-300 focus:ring-teal-500"
      />
      <div>
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </label>
  );
}

// Edit Modal Component
function EditModal({
  isOpen,
  onClose,
  title,
  children,
  onSave,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
          <div className="p-6 pb-4">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          <div className="px-6 pb-6">{children}</div>
          <div className="flex justify-end gap-3 px-6 pb-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 font-medium hover:text-gray-800"
            >
              CANCEL
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="px-4 py-2 bg-teal-600 text-white font-medium rounded-md hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? "SAVING..." : "SAVE"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RatingsTippingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTips, setSavingTips] = useState(false);
  const [settings, setSettings] = useState<RatingsSettings>({
    mode: "all",
    showToFieldTech: true,
    tipAmounts: [2, 5, 10],
  });
  const [editTipAmounts, setEditTipAmounts] = useState(false);
  const [editedTipAmounts, setEditedTipAmounts] = useState<[string, string, string]>(["2.00", "5.00", "10.00"]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const result = await res.json();
        const ratingsSettings = result.settings?.ratingsTipping || {};
        setSettings({
          mode: ratingsSettings.mode || "all",
          showToFieldTech: ratingsSettings.showToFieldTech ?? true,
          tipAmounts: ratingsSettings.tipAmounts || [2, 5, 10],
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveMainSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            ratingsTipping: {
              mode: settings.mode,
              showToFieldTech: settings.showToFieldTech,
              tipAmounts: settings.tipAmounts,
            },
          },
        }),
      });

      if (res.ok) {
        // Show success feedback
        alert("Settings saved successfully");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenTipEdit = () => {
    const amounts = settings.tipAmounts;
    setEditedTipAmounts([
      amounts[0]?.toFixed(2) || "2.00",
      amounts[1]?.toFixed(2) || "5.00",
      amounts[2]?.toFixed(2) || "10.00",
    ]);
    setEditTipAmounts(true);
  };

  const saveTipAmounts = async () => {
    setSavingTips(true);
    try {
      // Parse tip amounts from three separate inputs
      const amounts = editedTipAmounts
        .map((s) => parseFloat(s))
        .filter((n) => !isNaN(n) && n > 0);

      if (amounts.length === 0) {
        alert("Please enter at least one valid tip amount");
        setSavingTips(false);
        return;
      }

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            ratingsTipping: {
              ...settings,
              tipAmounts: amounts,
            },
          },
        }),
      });

      if (res.ok) {
        setSettings({ ...settings, tipAmounts: amounts });
        setEditTipAmounts(false);
      }
    } catch (error) {
      console.error("Error saving tip amounts:", error);
    } finally {
      setSavingTips(false);
    }
  };

  const formatTipAmounts = () => {
    return settings.tipAmounts.map((a) => `$${a.toFixed(2)}`).join(", ");
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
        <span className="text-gray-400">RATINGS & COMMENTS/TIPPING</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ratings & Comments/Tipping</h1>
      </div>

      {/* Main Settings Card */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-8">
          {/* Left label */}
          <div>
            <h2 className="font-medium text-gray-900">Ratings & Comments/Tipping</h2>
          </div>

          {/* Right content */}
          <div className="space-y-6">
            {/* Radio options */}
            <div className="space-y-4">
              <RadioOption
                value="disabled"
                currentValue={settings.mode}
                onChange={(mode) => setSettings({ ...settings, mode })}
                label="Disable All"
                description="Don't let clients rate jobs."
              />

              <RadioOption
                value="ratings_only"
                currentValue={settings.mode}
                onChange={(mode) => setSettings({ ...settings, mode })}
                label="Enable Ratings & Comments Only"
                description="Clients may rate job quality and leave a comment but cannot leave a tip. Completed job notifications must be enabled for your client to be notified and click the link."
              />

              <RadioOption
                value="all"
                currentValue={settings.mode}
                onChange={(mode) => setSettings({ ...settings, mode })}
                label="Enable All"
                description="Clients may rate job quality, leave a comment and tip your field tech. Completed job notifications must be enabled for your client to be notified and click the link."
              />
            </div>
          </div>
        </div>

        {/* Show to Field Tech toggle */}
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-8 mt-8 pt-8 border-t border-gray-200">
          <div>
            <h2 className="font-medium text-gray-900">
              Show Client Ratings &<br />
              Comments to Field Tech
            </h2>
          </div>
          <div className="flex items-start gap-4">
            <Toggle
              checked={settings.showToFieldTech}
              onChange={(checked) => setSettings({ ...settings, showToFieldTech: checked })}
            />
            <p className="text-sm text-gray-500">
              Let field tech see client ratings and comments in the field tech app. They are able to see only their own ratings and comments.
            </p>
          </div>
        </div>

        {/* Save button */}
        <div className="mt-8">
          <button
            onClick={saveMainSettings}
            disabled={saving}
            className="px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? "SAVING..." : "SAVE CHANGES"}
          </button>
        </div>
      </section>

      {/* Tip Amounts Card */}
      <section className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-start justify-between p-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Tip Amounts</h2>
            <p className="text-teal-600 font-medium">
              {formatTipAmounts()}
              <span className="text-gray-500 font-normal ml-1">Default</span>
            </p>
            <p className="text-sm text-gray-500 mt-2 italic">
              Depending on your market, you may want to update the recommended tip amounts.
            </p>
          </div>
          <button
            onClick={handleOpenTipEdit}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700"
          >
            EDIT
          </button>
        </div>
      </section>

      {/* Edit Tip Amounts Modal */}
      <EditModal
        isOpen={editTipAmounts}
        onClose={() => setEditTipAmounts(false)}
        title="Edit Tip Amounts"
        onSave={saveTipAmounts}
        saving={savingTips}
      >
        <div className="space-y-6">
          {/* Amount 1 */}
          <div>
            <label className="block text-sm text-gray-500 mb-1">Amount 1</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">$</span>
              <input
                type="text"
                value={editedTipAmounts[0]}
                onChange={(e) => setEditedTipAmounts([e.target.value, editedTipAmounts[1], editedTipAmounts[2]])}
                className="flex-1 px-0 py-2 border-0 border-b border-gray-300 focus:outline-none focus:ring-0 focus:border-teal-500 text-gray-900"
              />
            </div>
          </div>

          {/* Amount 2 */}
          <div>
            <label className="block text-sm text-gray-500 mb-1">Amount 2</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">$</span>
              <input
                type="text"
                value={editedTipAmounts[1]}
                onChange={(e) => setEditedTipAmounts([editedTipAmounts[0], e.target.value, editedTipAmounts[2]])}
                className="flex-1 px-0 py-2 border-0 border-b border-gray-300 focus:outline-none focus:ring-0 focus:border-teal-500 text-gray-900"
              />
            </div>
          </div>

          {/* Amount 3 */}
          <div>
            <label className="block text-sm text-gray-500 mb-1">Amount 3</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">$</span>
              <input
                type="text"
                value={editedTipAmounts[2]}
                onChange={(e) => setEditedTipAmounts([editedTipAmounts[0], editedTipAmounts[1], e.target.value])}
                className="flex-1 px-0 py-2 border-0 border-b border-gray-300 focus:outline-none focus:ring-0 focus:border-teal-500 text-gray-900"
              />
            </div>
          </div>
        </div>
      </EditModal>
    </div>
  );
}
