"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { X } from "lucide-react";

interface DashboardSettings {
  widgets: Record<string, boolean>;
  shortcuts: Record<string, boolean>;
  assistance: Record<string, boolean>;
}

const WIDGET_OPTIONS = [
  // Left column
  { key: "unassignedLocations", label: "Unassigned Locations", column: "left" },
  { key: "openOneTimeInvoices", label: "Open One-Time Invoices", column: "left" },
  { key: "overdueOneTimeInvoices", label: "Overdue One-Time Invoices", column: "left" },
  { key: "failedOneTimeInvoices", label: "Failed One-Time Invoices", column: "left" },
  { key: "openJobs", label: "Open Jobs", column: "left" },
  { key: "oneTimeInvoiceDrafts", label: "One-Time Invoice Drafts", column: "left" },
  { key: "openShifts", label: "Open Shifts", column: "left" },
  { key: "clockedInStaff", label: "Clocked In Staff", column: "left" },
  { key: "completedJobsPerWeek", label: "Completed Jobs per Week", column: "left" },
  { key: "totalSales", label: "Total Sales", column: "left" },
  { key: "activeResidentialClients", label: "Active Residential Clients", column: "left" },
  { key: "newVsLostResidentialClients", label: "New VS Lost Residential Clients", column: "left" },
  { key: "averageResidentialClientValue", label: "Average Residential Client Value", column: "left" },
  { key: "residentialCancelationReasons", label: "Residential Cancelation Reasons", column: "left" },
  { key: "referralSources", label: "Referral Sources", column: "left" },
  { key: "averageClientsPerTech", label: "Average Clients per Tech", column: "left" },
  { key: "averageYardsPerRoute", label: "Average Yards (Jobs) per Route", column: "left" },
  { key: "clientLifetimeValue", label: "Client Lifetime Value", column: "left" },
  // Right column
  { key: "changeRequests", label: "Change Requests", column: "right" },
  { key: "openRecurringInvoices", label: "Open Recurring Invoices", column: "right" },
  { key: "overdueRecurringInvoices", label: "Overdue Recurring Invoices", column: "right" },
  { key: "failedRecurringInvoices", label: "Failed Recurring Invoices", column: "right" },
  { key: "recurringInvoiceDrafts", label: "Recurring Invoice Drafts", column: "right" },
  { key: "unoptimizedRoutes", label: "Unoptimized Routes", column: "right" },
  { key: "incompleteShifts", label: "Incomplete Shifts", column: "right" },
  { key: "staffOnBreak", label: "Staff On Break", column: "right" },
  { key: "startEndMyShift", label: "Start/End My Shift", column: "right" },
  { key: "productServiceSales", label: "Product & Service Sales", column: "right" },
  { key: "activeCommercialClients", label: "Active Commercial Clients", column: "right" },
  { key: "newVsLostCommercialClients", label: "New VS Lost Commercial Clients", column: "right" },
  { key: "averageCommercialClientValue", label: "Average Commercial Client Value", column: "right" },
  { key: "commercialCancelationReasons", label: "Commercial Cancelation Reasons", column: "right" },
  { key: "totalPayments", label: "Total Payments", column: "right" },
  { key: "averageYardsPerHour", label: "Average Yards (Jobs) per Hour", column: "right" },
  { key: "churnRate", label: "Churn Rate", column: "right" },
];

const SHORTCUT_OPTIONS = [
  { key: "fieldTechApp", label: "Field Tech App", column: "left" },
  { key: "clientPortal", label: "Client Portal", column: "right" },
  { key: "newClientPlanner", label: "New Client Planner", column: "left" },
];

const ASSISTANCE_OPTIONS = [
  { key: "writtenTutorials", label: "Written Tutorials", column: "left" },
  { key: "liveTraining", label: "Live Training", column: "right" },
  { key: "emailSupport", label: "Email Support", column: "left" },
  { key: "urgentHelp", label: "Urgent Help (M-F 6AM-5PM ET)", column: "right" },
];

const DEFAULT_WIDGETS: Record<string, boolean> = {
  unassignedLocations: true,
  openOneTimeInvoices: true,
  overdueOneTimeInvoices: true,
  failedOneTimeInvoices: true,
  openJobs: true,
  oneTimeInvoiceDrafts: true,
  openShifts: true,
  clockedInStaff: true,
  completedJobsPerWeek: false,
  totalSales: true,
  activeResidentialClients: true,
  newVsLostResidentialClients: true,
  averageResidentialClientValue: true,
  residentialCancelationReasons: true,
  referralSources: true,
  averageClientsPerTech: true,
  averageYardsPerRoute: true,
  clientLifetimeValue: true,
  changeRequests: true,
  openRecurringInvoices: true,
  overdueRecurringInvoices: true,
  failedRecurringInvoices: true,
  recurringInvoiceDrafts: true,
  unoptimizedRoutes: true,
  incompleteShifts: true,
  staffOnBreak: true,
  startEndMyShift: false,
  productServiceSales: false,
  activeCommercialClients: true,
  newVsLostCommercialClients: true,
  averageCommercialClientValue: true,
  commercialCancelationReasons: true,
  totalPayments: false,
  averageYardsPerHour: true,
  churnRate: true,
};

const DEFAULT_SHORTCUTS: Record<string, boolean> = {
  fieldTechApp: true,
  clientPortal: true,
  newClientPlanner: true,
};

const DEFAULT_ASSISTANCE: Record<string, boolean> = {
  writtenTutorials: true,
  liveTraining: true,
  emailSupport: true,
  urgentHelp: true,
};

const DEFAULT_SETTINGS: DashboardSettings = {
  widgets: DEFAULT_WIDGETS,
  shortcuts: DEFAULT_SHORTCUTS,
  assistance: DEFAULT_ASSISTANCE,
};

// Checkbox Component
function Checkbox({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-3 ${disabled ? "cursor-default" : "cursor-pointer"}`}>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <div
          className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
            checked ? "bg-teal-600" : "bg-white border-2 border-gray-300"
          } ${disabled ? "opacity-60" : ""}`}
        >
          {checked && (
            <svg
              className="w-3.5 h-3.5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
      </div>
      <span className={`text-sm ${disabled ? "text-gray-400" : "text-gray-700"}`}>{label}</span>
    </label>
  );
}

type ModalType = "widgets" | "shortcuts" | "assistance" | null;

export default function CustomizeDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<DashboardSettings>(DEFAULT_SETTINGS);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [tempSettings, setTempSettings] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        const dashboardSettings = data.settings?.dashboard || {};
        setSettings({
          widgets: { ...DEFAULT_WIDGETS, ...dashboardSettings.widgets },
          shortcuts: { ...DEFAULT_SHORTCUTS, ...dashboardSettings.shortcuts },
          assistance: { ...DEFAULT_ASSISTANCE, ...dashboardSettings.assistance },
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openModal = (type: ModalType) => {
    if (type === "widgets") {
      setTempSettings({ ...settings.widgets });
    } else if (type === "shortcuts") {
      setTempSettings({ ...settings.shortcuts });
    } else if (type === "assistance") {
      setTempSettings({ ...settings.assistance });
    }
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal(null);
    setTempSettings({});
  };

  const handleSave = async () => {
    if (!activeModal) return;

    setSaving(true);
    try {
      const updatedSettings = { ...settings };
      if (activeModal === "widgets") {
        updatedSettings.widgets = tempSettings;
      } else if (activeModal === "shortcuts") {
        updatedSettings.shortcuts = tempSettings;
      } else if (activeModal === "assistance") {
        updatedSettings.assistance = tempSettings;
      }

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: { dashboard: updatedSettings },
        }),
      });

      if (res.ok) {
        setSettings(updatedSettings);
        closeModal();
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    if (activeModal === "widgets") {
      setTempSettings({ ...DEFAULT_WIDGETS });
    } else if (activeModal === "shortcuts") {
      setTempSettings({ ...DEFAULT_SHORTCUTS });
    } else if (activeModal === "assistance") {
      setTempSettings({ ...DEFAULT_ASSISTANCE });
    }
  };

  const getModalTitle = () => {
    switch (activeModal) {
      case "widgets":
        return "Show/Hide Dashboard Widgets";
      case "shortcuts":
        return "Show/Hide Shortcuts";
      case "assistance":
        return "Show/Hide Assistance";
      default:
        return "";
    }
  };

  const getModalDescription = () => {
    switch (activeModal) {
      case "widgets":
        return "Each user can customize the contents of their dashboard. Your changes will be remembered the next time that you log in.";
      case "shortcuts":
        return "Choose which shortcuts to display on your dashboard.";
      case "assistance":
        return "Choose which assistance options to display on your dashboard.";
      default:
        return "";
    }
  };

  const getModalOptions = () => {
    switch (activeModal) {
      case "widgets":
        return WIDGET_OPTIONS;
      case "shortcuts":
        return SHORTCUT_OPTIONS;
      case "assistance":
        return ASSISTANCE_OPTIONS;
      default:
        return [];
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  const leftWidgets = WIDGET_OPTIONS.filter((w) => w.column === "left");
  const rightWidgets = WIDGET_OPTIONS.filter((w) => w.column === "right");
  const leftShortcuts = SHORTCUT_OPTIONS.filter((s) => s.column === "left");
  const rightShortcuts = SHORTCUT_OPTIONS.filter((s) => s.column === "right");
  const leftAssistance = ASSISTANCE_OPTIONS.filter((a) => a.column === "left");
  const rightAssistance = ASSISTANCE_OPTIONS.filter((a) => a.column === "right");

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500">
        <Link href="/app/office/settings" className="text-teal-600 hover:text-teal-700">
          SETTINGS
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-400">CUSTOMIZE DASHBOARD</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customize Dashboard</h1>
      </div>

      {/* Dashboard Widgets Section */}
      <section className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Dashboard Widgets</h2>
          <button
            onClick={() => openModal("widgets")}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700"
          >
            EDIT
          </button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-x-12 gap-y-3">
            <div className="space-y-3">
              {leftWidgets.map((widget) => (
                <Checkbox
                  key={widget.key}
                  label={widget.label}
                  checked={settings.widgets[widget.key] ?? false}
                  onChange={() => {}}
                  disabled
                />
              ))}
            </div>
            <div className="space-y-3">
              {rightWidgets.map((widget) => (
                <Checkbox
                  key={widget.key}
                  label={widget.label}
                  checked={settings.widgets[widget.key] ?? false}
                  onChange={() => {}}
                  disabled
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Shortcuts Section */}
      <section className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Shortcuts</h2>
          <button
            onClick={() => openModal("shortcuts")}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700"
          >
            EDIT
          </button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-x-12 gap-y-3">
            <div className="space-y-3">
              {leftShortcuts.map((shortcut) => (
                <Checkbox
                  key={shortcut.key}
                  label={shortcut.label}
                  checked={settings.shortcuts[shortcut.key] ?? false}
                  onChange={() => {}}
                  disabled
                />
              ))}
            </div>
            <div className="space-y-3">
              {rightShortcuts.map((shortcut) => (
                <Checkbox
                  key={shortcut.key}
                  label={shortcut.label}
                  checked={settings.shortcuts[shortcut.key] ?? false}
                  onChange={() => {}}
                  disabled
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Assistance Section */}
      <section className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Assistance</h2>
          <button
            onClick={() => openModal("assistance")}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700"
          >
            EDIT
          </button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-x-12 gap-y-3">
            <div className="space-y-3">
              {leftAssistance.map((item) => (
                <Checkbox
                  key={item.key}
                  label={item.label}
                  checked={settings.assistance[item.key] ?? false}
                  onChange={() => {}}
                  disabled
                />
              ))}
            </div>
            <div className="space-y-3">
              {rightAssistance.map((item) => (
                <Checkbox
                  key={item.key}
                  label={item.label}
                  checked={settings.assistance[item.key] ?? false}
                  onChange={() => {}}
                  disabled
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Edit Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-900">{getModalTitle()}</h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-4 overflow-y-auto flex-1">
                <p className="text-sm text-gray-500 mb-6">{getModalDescription()}</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <div className="space-y-3">
                    {getModalOptions()
                      .filter((opt) => opt.column === "left")
                      .map((option) => (
                        <Checkbox
                          key={option.key}
                          label={option.label}
                          checked={tempSettings[option.key] ?? false}
                          onChange={(checked) =>
                            setTempSettings({ ...tempSettings, [option.key]: checked })
                          }
                        />
                      ))}
                  </div>
                  <div className="space-y-3">
                    {getModalOptions()
                      .filter((opt) => opt.column === "right")
                      .map((option) => (
                        <Checkbox
                          key={option.key}
                          label={option.label}
                          checked={tempSettings[option.key] ?? false}
                          onChange={(checked) =>
                            setTempSettings({ ...tempSettings, [option.key]: checked })
                          }
                        />
                      ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
                <button
                  onClick={handleResetToDefault}
                  className="text-teal-600 hover:text-teal-700 text-sm font-medium"
                >
                  Reset To Default
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-gray-600 font-medium hover:text-gray-800"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-teal-600 text-white font-medium rounded-md hover:bg-teal-700 disabled:opacity-50"
                  >
                    {saving ? "SAVING..." : "SAVE"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
