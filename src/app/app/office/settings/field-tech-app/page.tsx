"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface FieldTechAppSettings {
  directions: {
    useDestinationAddress: boolean;
  };
  routeReoptimization: {
    allowReoptimize: boolean;
  };
  skippedCompletedJobs: {
    customNoteToClient: boolean;
    attachPhotoForClient: boolean;
  };
  clientInfoVisibility: {
    homePhone: boolean;
    cellPhone: boolean;
    email: boolean;
  };
  spentTime: {
    showSpentVsEstimated: boolean;
  };
  paySlipsProductivity: {
    showPaySlips: boolean;
  };
  ratingsComments: {
    showToFieldTech: boolean;
  };
  commercialWorkAreas: {
    showWorkAreasCards: boolean;
  };
}

const defaultSettings: FieldTechAppSettings = {
  directions: {
    useDestinationAddress: false,
  },
  routeReoptimization: {
    allowReoptimize: true,
  },
  skippedCompletedJobs: {
    customNoteToClient: true,
    attachPhotoForClient: true,
  },
  clientInfoVisibility: {
    homePhone: true,
    cellPhone: true,
    email: true,
  },
  spentTime: {
    showSpentVsEstimated: true,
  },
  paySlipsProductivity: {
    showPaySlips: false,
  },
  ratingsComments: {
    showToFieldTech: true,
  },
  commercialWorkAreas: {
    showWorkAreasCards: false,
  },
};

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: () => void;
}

function ToggleSwitch({ enabled, onChange }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? "bg-teal-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

interface SettingRowProps {
  label: string;
  description: string;
  enabled: boolean;
  onChange: () => void;
}

function SettingRow({ label, description, enabled, onChange }: SettingRowProps) {
  return (
    <div className="py-4 border-b border-gray-100 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-900">{label}</label>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
        <ToggleSwitch enabled={enabled} onChange={onChange} />
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  saving: boolean;
  onSave: () => void;
}

function Section({ title, children, saving, onSave }: SectionProps) {
  return (
    <section className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-0">{children}</div>
      <div className="mt-6">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-6 py-2 bg-teal-600 text-white font-medium rounded-md hover:bg-teal-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "SAVE CHANGES"}
        </button>
      </div>
    </section>
  );
}

export default function FieldTechAppPage() {
  const [settings, setSettings] = useState<FieldTechAppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/field-tech-app");
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings({ ...defaultSettings, ...data.settings });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async (section: string) => {
    setSavingSection(section);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch("/api/admin/field-tech-app", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      setSuccessMessage("Settings saved successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSavingSection(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-sm text-gray-500">
          <Link href="/app/office/settings" className="text-teal-600 hover:text-teal-700">
            SETTINGS
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-400">FIELD TECH APP</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Field Tech App</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
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
        <span className="text-gray-400">FIELD TECH APP</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Field Tech App</h1>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-700">
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Directions */}
      <Section
        title="Directions"
        saving={savingSection === "directions"}
        onSave={() => saveSettings("directions")}
      >
        <SettingRow
          label="Use Destination Address (Google Maps Only)"
          description="Let Google Maps determine geolocation (latitude, longitude) of the destination address."
          enabled={settings.directions.useDestinationAddress}
          onChange={() =>
            setSettings((prev) => ({
              ...prev,
              directions: {
                ...prev.directions,
                useDestinationAddress: !prev.directions.useDestinationAddress,
              },
            }))
          }
        />
      </Section>

      {/* Route Reoptimization */}
      <Section
        title="Route Reoptimization"
        saving={savingSection === "routeReoptimization"}
        onSave={() => saveSettings("routeReoptimization")}
      >
        <SettingRow
          label="Allow Field Techs to Reoptimize Routes"
          description="Let field tech reoptimize routes from the field tech app."
          enabled={settings.routeReoptimization.allowReoptimize}
          onChange={() =>
            setSettings((prev) => ({
              ...prev,
              routeReoptimization: {
                ...prev.routeReoptimization,
                allowReoptimize: !prev.routeReoptimization.allowReoptimize,
              },
            }))
          }
        />
      </Section>

      {/* Skipped and Completed Jobs */}
      <Section
        title="Skipped and Completed Jobs"
        saving={savingSection === "skippedCompletedJobs"}
        onSave={() => saveSettings("skippedCompletedJobs")}
      >
        <SettingRow
          label="Custom Note to Client"
          description="Let field techs send custom job notes to clients. Good option if you trust your field staff and want to improve communication speed."
          enabled={settings.skippedCompletedJobs.customNoteToClient}
          onChange={() =>
            setSettings((prev) => ({
              ...prev,
              skippedCompletedJobs: {
                ...prev.skippedCompletedJobs,
                customNoteToClient: !prev.skippedCompletedJobs.customNoteToClient,
              },
            }))
          }
        />
        <SettingRow
          label="Attach Photo for Client"
          description="Let field techs send photos to clients. Good option if you trust your field staff and want them to send clients a photo (example: a photo of locked gate)."
          enabled={settings.skippedCompletedJobs.attachPhotoForClient}
          onChange={() =>
            setSettings((prev) => ({
              ...prev,
              skippedCompletedJobs: {
                ...prev.skippedCompletedJobs,
                attachPhotoForClient: !prev.skippedCompletedJobs.attachPhotoForClient,
              },
            }))
          }
        />
      </Section>

      {/* Show/Hide Client Info to Field Tech */}
      <Section
        title="Show/Hide Client Info to Field Tech"
        saving={savingSection === "clientInfoVisibility"}
        onSave={() => saveSettings("clientInfoVisibility")}
      >
        <SettingRow
          label="Client Home Phone"
          description="Let field techs see the client home phone number in the field tech app."
          enabled={settings.clientInfoVisibility.homePhone}
          onChange={() =>
            setSettings((prev) => ({
              ...prev,
              clientInfoVisibility: {
                ...prev.clientInfoVisibility,
                homePhone: !prev.clientInfoVisibility.homePhone,
              },
            }))
          }
        />
        <SettingRow
          label="Client Cell Phone"
          description="Let field techs see the client cell phone number in the field tech app."
          enabled={settings.clientInfoVisibility.cellPhone}
          onChange={() =>
            setSettings((prev) => ({
              ...prev,
              clientInfoVisibility: {
                ...prev.clientInfoVisibility,
                cellPhone: !prev.clientInfoVisibility.cellPhone,
              },
            }))
          }
        />
        <SettingRow
          label="Client Email"
          description="Let field techs see the client email in the field tech app."
          enabled={settings.clientInfoVisibility.email}
          onChange={() =>
            setSettings((prev) => ({
              ...prev,
              clientInfoVisibility: {
                ...prev.clientInfoVisibility,
                email: !prev.clientInfoVisibility.email,
              },
            }))
          }
        />
      </Section>

      {/* Spent Time */}
      <Section
        title="Spent Time"
        saving={savingSection === "spentTime"}
        onSave={() => saveSettings("spentTime")}
      >
        <SettingRow
          label="Show Spent vs Estimated Job Time"
          description="Show Spent vs Estimated Job Time in Field Tech App."
          enabled={settings.spentTime.showSpentVsEstimated}
          onChange={() =>
            setSettings((prev) => ({
              ...prev,
              spentTime: {
                ...prev.spentTime,
                showSpentVsEstimated: !prev.spentTime.showSpentVsEstimated,
              },
            }))
          }
        />
      </Section>

      {/* Pay Slips & Productivity Report */}
      <Section
        title="Pay Slips & Productivity Report Within Field Tech App"
        saving={savingSection === "paySlipsProductivity"}
        onSave={() => saveSettings("paySlipsProductivity")}
      >
        <SettingRow
          label="Pay Slips & Productivity Report"
          description="Let field techs see Pay Slips & Productivity Report in the field tech app."
          enabled={settings.paySlipsProductivity.showPaySlips}
          onChange={() =>
            setSettings((prev) => ({
              ...prev,
              paySlipsProductivity: {
                ...prev.paySlipsProductivity,
                showPaySlips: !prev.paySlipsProductivity.showPaySlips,
              },
            }))
          }
        />
      </Section>

      {/* Show Ratings & Comments to Field Tech */}
      <Section
        title="Show Ratings & Comments to Field Tech"
        saving={savingSection === "ratingsComments"}
        onSave={() => saveSettings("ratingsComments")}
      >
        <SettingRow
          label="Show Client Ratings & Comments to Field Tech"
          description="Let field tech see client ratings and comments in the field tech app. They are able to see only their own ratings and comments."
          enabled={settings.ratingsComments.showToFieldTech}
          onChange={() =>
            setSettings((prev) => ({
              ...prev,
              ratingsComments: {
                ...prev.ratingsComments,
                showToFieldTech: !prev.ratingsComments.showToFieldTech,
              },
            }))
          }
        />
      </Section>

      {/* Commercial Clients Work Areas */}
      <Section
        title="Commercial Clients Work Areas"
        saving={savingSection === "commercialWorkAreas"}
        onSave={() => saveSettings("commercialWorkAreas")}
      >
        <SettingRow
          label="Show Work Areas Cards on Complete Job"
          description='Activate "Commercial Work Areas" to display them directly in the field tech app. Customize repair responses, skip reasons, and monitor pet station levels. Manage work area brands and models for a tailored experience.'
          enabled={settings.commercialWorkAreas.showWorkAreasCards}
          onChange={() =>
            setSettings((prev) => ({
              ...prev,
              commercialWorkAreas: {
                ...prev.commercialWorkAreas,
                showWorkAreasCards: !prev.commercialWorkAreas.showWorkAreasCards,
              },
            }))
          }
        />
      </Section>
    </div>
  );
}
