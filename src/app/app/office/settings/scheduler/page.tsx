"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface SchedulerSettings {
  createJobsInAdvance: number;
  gatedCommunities: boolean;
  showFieldTechPhone: boolean;
  emailPreliminarySchedule: "never" | "weekly" | "daily";
  locationDistanceTolerance: number;
  cleanupDurationTolerance: number;
}

// Modal Component
function Modal({
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
            <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:text-gray-800">
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

// Setting Row Component
function SettingRow({
  title,
  value,
  description,
  onEdit,
}: {
  title: string;
  value: string;
  description: string;
  onEdit: () => void;
}) {
  return (
    <section className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="text-teal-600 font-medium mt-1">{value}</p>
          <p className="text-sm text-gray-500 mt-2 italic">{description}</p>
        </div>
        <button
          onClick={onEdit}
          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700"
        >
          EDIT
        </button>
      </div>
    </section>
  );
}

// Dropdown Select Component
function SelectDropdown({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <label className="block text-sm text-teal-600 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 border-b border-gray-300 text-left focus:outline-none focus:border-teal-500"
      >
        <span className="text-gray-900">{selectedOption?.label || value}</span>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left hover:bg-teal-50 ${
                option.value === value ? "bg-teal-100 text-teal-700" : "text-gray-900"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Toggle Component
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-teal-600" : "bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <span className="text-gray-700">{label}</span>
    </label>
  );
}

export default function SchedulerSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SchedulerSettings>({
    createJobsInAdvance: 0,
    gatedCommunities: false,
    showFieldTechPhone: true,
    emailPreliminarySchedule: "weekly",
    locationDistanceTolerance: 1000,
    cleanupDurationTolerance: 100,
  });

  // Modal states
  const [editModal, setEditModal] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editToggle, setEditToggle] = useState(false);
  const [editNumber, setEditNumber] = useState(0);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const result = await res.json();
        const scheduler = result.settings?.scheduler || {};
        setSettings({
          createJobsInAdvance: scheduler.createJobsInAdvance ?? 0,
          gatedCommunities: scheduler.gatedCommunities ?? false,
          showFieldTechPhone: scheduler.showFieldTechPhone ?? true,
          emailPreliminarySchedule: scheduler.emailPreliminarySchedule || "weekly",
          locationDistanceTolerance: scheduler.locationDistanceTolerance ?? 1000,
          cleanupDurationTolerance: scheduler.cleanupDurationTolerance ?? 100,
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

  const saveSettings = async (updates: Partial<SchedulerSettings>) => {
    setSaving(true);
    try {
      const newSettings = { ...settings, ...updates };
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { scheduler: newSettings } }),
      });
      if (res.ok) {
        setSettings(newSettings);
        setEditModal(null);
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const getCreateJobsLabel = () => {
    if (settings.createJobsInAdvance === 0) return "0 (DEFAULT)";
    return String(settings.createJobsInAdvance);
  };

  const getGatedCommunitiesLabel = () => {
    return settings.gatedCommunities ? "YES" : "NO (DEFAULT)";
  };

  const getEmailScheduleLabel = () => {
    const labels: Record<string, string> = {
      never: "NEVER",
      weekly: "WEEKLY",
      daily: "DAILY",
    };
    return labels[settings.emailPreliminarySchedule] || "WEEKLY";
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
        <span className="text-gray-400">SCHEDULER</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scheduler</h1>
      </div>

      {/* Create Jobs in Advance */}
      <SettingRow
        title="Create Jobs in Advance"
        value={getCreateJobsLabel()}
        description="Choose how far in advance you would like to auto-dispatch your jobs. By default (0), jobs are dispatched at midnight for the upcoming day but you may also create jobs up to 7 days in advance."
        onEdit={() => {
          setEditValue(String(settings.createJobsInAdvance));
          setEditModal("createJobsInAdvance");
        }}
      />

      {/* Gated Communities */}
      <SettingRow
        title="Gated Communities"
        value={getGatedCommunitiesLabel()}
        description='Select "Yes" if you service clients within gated communities or on private roads.'
        onEdit={() => {
          setEditValue(settings.gatedCommunities ? "yes" : "no");
          setEditModal("gatedCommunities");
        }}
      />

      {/* Show Field Tech Cell Phone */}
      <SettingRow
        title="Show Field Tech Cell Phone"
        value={settings.showFieldTechPhone ? "YES" : "NO"}
        description='Improve your client and field tech communication by embedding the field tech phone number within "On the Way" and "Completed" job notifications.'
        onEdit={() => {
          setEditToggle(settings.showFieldTechPhone);
          setEditModal("showFieldTechPhone");
        }}
      />

      {/* Email Preliminary Schedule */}
      <SettingRow
        title="Email Preliminary Schedule to Field Techs"
        value={getEmailScheduleLabel()}
        description="By default, the app will email a preliminary weekly schedule to your techs every Monday. Alternatively, you may email a daily schedule after jobs are dispatched and routes auto-optimized. The daily option may be useful in areas with bad online connectivity or if the field tech app was temporarily unavailable for any reason. Or you may decide to turn off these email notifications."
        onEdit={() => {
          setEditValue(settings.emailPreliminarySchedule);
          setEditModal("emailPreliminarySchedule");
        }}
      />

      {/* Location Distance Tolerance */}
      <SettingRow
        title="Location Distance Tolerance (ft)"
        value={`${settings.locationDistanceTolerance} ft`}
        description={`Set a safe radius around the client location that would not set off the alarm "Field tech started/completed job too far from the client location." Example: Location distance tolerance is 300 feet. If a job is done 300 feet or closer to the client's location, it will not trigger an alarm!`}
        onEdit={() => {
          setEditNumber(settings.locationDistanceTolerance);
          setEditModal("locationDistanceTolerance");
        }}
      />

      {/* Cleanup Duration Tolerance */}
      <SettingRow
        title="Cleanup Duration Tolerance (%)"
        value={`${settings.cleanupDurationTolerance}%`}
        description={`Set the expected cleanup duration tolerance so that it will not trigger the alarm: "Field tech recorded too little / too much time at client location". Example: Estimated Cleanup Time is 10 min and Cleanup Duration Tolerance is 40%. If your field tech completes the cleanup between 6 min and 14 min, an alert will not appear.`}
        onEdit={() => {
          setEditNumber(settings.cleanupDurationTolerance);
          setEditModal("cleanupDurationTolerance");
        }}
      />

      {/* Modals */}

      {/* Create Jobs in Advance Modal */}
      <Modal
        isOpen={editModal === "createJobsInAdvance"}
        onClose={() => setEditModal(null)}
        title="Edit Create Jobs in Advance"
        onSave={() => saveSettings({ createJobsInAdvance: parseInt(editValue) })}
        saving={saving}
      >
        <SelectDropdown
          label="Job Creation"
          value={editValue}
          onChange={setEditValue}
          options={[
            { value: "0", label: "0 (Default)" },
            { value: "1", label: "1" },
            { value: "2", label: "2" },
            { value: "3", label: "3" },
            { value: "4", label: "4" },
            { value: "5", label: "5" },
            { value: "6", label: "6" },
            { value: "7", label: "7" },
          ]}
        />
      </Modal>

      {/* Gated Communities Modal */}
      <Modal
        isOpen={editModal === "gatedCommunities"}
        onClose={() => setEditModal(null)}
        title="Edit Gated Communities"
        onSave={() => saveSettings({ gatedCommunities: editValue === "yes" })}
        saving={saving}
      >
        <SelectDropdown
          label="Gated Communities"
          value={editValue}
          onChange={setEditValue}
          options={[
            { value: "no", label: "No (Default)" },
            { value: "yes", label: "Yes" },
          ]}
        />
      </Modal>

      {/* Show Field Tech Phone Modal */}
      <Modal
        isOpen={editModal === "showFieldTechPhone"}
        onClose={() => setEditModal(null)}
        title="Edit Show Field Tech Cell Phone"
        onSave={() => saveSettings({ showFieldTechPhone: editToggle })}
        saving={saving}
      >
        <Toggle
          checked={editToggle}
          onChange={setEditToggle}
          label="Show Field Tech Cell Phone"
        />
      </Modal>

      {/* Email Preliminary Schedule Modal */}
      <Modal
        isOpen={editModal === "emailPreliminarySchedule"}
        onClose={() => setEditModal(null)}
        title="Edit Email Preliminary Schedule to Field Techs"
        onSave={() => saveSettings({ emailPreliminarySchedule: editValue as SchedulerSettings["emailPreliminarySchedule"] })}
        saving={saving}
      >
        <SelectDropdown
          label="Email Preliminary Schedule to Field Techs"
          value={editValue}
          onChange={setEditValue}
          options={[
            { value: "never", label: "Never" },
            { value: "weekly", label: "Weekly" },
            { value: "daily", label: "Daily" },
          ]}
        />
      </Modal>

      {/* Location Distance Tolerance Modal */}
      <Modal
        isOpen={editModal === "locationDistanceTolerance"}
        onClose={() => setEditModal(null)}
        title="Edit Location Distance Tolerance"
        onSave={() => saveSettings({ locationDistanceTolerance: editNumber })}
        saving={saving}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Margin of error</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={editNumber}
                onChange={(e) => setEditNumber(parseInt(e.target.value) || 0)}
                className="flex-1 px-3 py-2 border-b border-gray-300 focus:outline-none focus:border-teal-500 text-gray-900"
              />
              <span className="text-gray-500">ft</span>
            </div>
          </div>
          <div className="p-4 bg-teal-50 rounded-lg border border-teal-100">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-teal-800">
                GPS-enabled smartphones are typically accurate to within 16 feet radius under open sky. However, their accuracy worsens near buildings, bridges, and trees. Also allow for large enough radius if you require field techs to park their vehicle on the street. You may also always update these settings if you find that your limit is too strict / relaxed.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Cleanup Duration Tolerance Modal */}
      <Modal
        isOpen={editModal === "cleanupDurationTolerance"}
        onClose={() => setEditModal(null)}
        title="Edit Cleanup Duration Tolerance"
        onSave={() => saveSettings({ cleanupDurationTolerance: editNumber })}
        saving={saving}
      >
        <div>
          <label className="block text-sm text-gray-500 mb-1">Margin of error</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={editNumber}
              onChange={(e) => setEditNumber(parseInt(e.target.value) || 0)}
              className="flex-1 px-3 py-2 border-b border-gray-300 focus:outline-none focus:border-teal-500 text-gray-900"
            />
            <span className="text-gray-500">%</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
