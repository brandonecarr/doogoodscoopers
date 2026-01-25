"use client";

import { useState, useEffect } from "react";
import {
  Megaphone,
  Plus,
  Mail,
  MessageSquare,
  Webhook,
  MapPin,
  Settings,
  Trash2,
  Edit,
  Check,
  X,
  RefreshCw,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";

interface Integration {
  id: string;
  provider: "MAILCHIMP" | "EZTEXTING" | "DIRECT_MAIL" | "WEBHOOK_GENERIC";
  name: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
  syncStats: {
    success: number;
    failed: number;
    pending: number;
  };
  createdAt: string;
  updatedAt?: string;
}

interface RemarketingSettings {
  remarketingEnabled: boolean;
  remarketingMaxMessages: number;
}

const PROVIDER_INFO = {
  MAILCHIMP: {
    name: "Mailchimp",
    icon: Mail,
    color: "bg-yellow-100 text-yellow-700",
    description: "Email marketing and automation",
    fields: [
      { key: "apiKey", label: "API Key", type: "password", required: true },
      { key: "listId", label: "Audience/List ID", type: "text", required: true },
    ],
  },
  EZTEXTING: {
    name: "EZTexting",
    icon: MessageSquare,
    color: "bg-blue-100 text-blue-700",
    description: "SMS marketing platform",
    fields: [
      { key: "username", label: "Username", type: "text", required: true },
      { key: "apiKey", label: "API Key", type: "password", required: true },
      { key: "groupId", label: "Group ID", type: "text", required: false },
    ],
  },
  DIRECT_MAIL: {
    name: "Direct Mail",
    icon: MapPin,
    color: "bg-green-100 text-green-700",
    description: "Physical mail campaigns via webhook",
    fields: [
      { key: "webhookUrl", label: "Webhook URL", type: "url", required: true },
    ],
  },
  WEBHOOK_GENERIC: {
    name: "Generic Webhook",
    icon: Webhook,
    color: "bg-purple-100 text-purple-700",
    description: "Custom webhook integration",
    fields: [
      { key: "url", label: "Webhook URL", type: "url", required: true },
      { key: "secret", label: "Signing Secret", type: "password", required: false },
    ],
  },
};

export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState<"integrations" | "settings" | "activity">("integrations");
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [settings, setSettings] = useState<RemarketingSettings>({
    remarketingEnabled: true,
    remarketingMaxMessages: 3,
  });

  const [showModal, setShowModal] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [formData, setFormData] = useState<{
    provider: string;
    name: string;
    config: Record<string, string>;
    isEnabled: boolean;
  }>({
    provider: "",
    name: "",
    config: {},
    isEnabled: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchIntegrations();
    fetchSettings();
  }, []);

  async function fetchIntegrations() {
    setLoading(true);
    try {
      const res = await fetch("/api/marketing/integrations");
      const data = await res.json();
      if (res.ok) {
        setIntegrations(data.integrations || []);
      }
    } catch (error) {
      console.error("Error fetching integrations:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSettings() {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (res.ok && data.settings) {
        setSettings({
          remarketingEnabled: data.settings.remarketing_enabled !== false,
          remarketingMaxMessages: data.settings.remarketingMaxMessages || 3,
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            remarketing_enabled: settings.remarketingEnabled,
            remarketingMaxMessages: settings.remarketingMaxMessages,
          },
        }),
      });
      if (res.ok) {
        alert("Settings saved!");
      } else {
        alert("Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function openCreateModal(provider: string) {
    const info = PROVIDER_INFO[provider as keyof typeof PROVIDER_INFO];
    setEditingIntegration(null);
    setFormData({
      provider,
      name: info.name,
      config: {},
      isEnabled: true,
    });
    setShowModal(true);
  }

  function openEditModal(integration: Integration) {
    setEditingIntegration(integration);
    setFormData({
      provider: integration.provider,
      name: integration.name,
      config: integration.config as Record<string, string>,
      isEnabled: integration.isEnabled,
    });
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const url = "/api/marketing/integrations";
      const method = editingIntegration ? "PUT" : "POST";
      const body = editingIntegration
        ? { id: editingIntegration.id, ...formData }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowModal(false);
        fetchIntegrations();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save integration");
      }
    } catch (error) {
      console.error("Error saving integration:", error);
      alert("Failed to save integration");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this integration?")) return;

    try {
      const res = await fetch(`/api/marketing/integrations?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchIntegrations();
      } else {
        alert("Failed to delete integration");
      }
    } catch (error) {
      console.error("Error deleting integration:", error);
    }
  }

  async function toggleEnabled(integration: Integration) {
    try {
      const res = await fetch("/api/marketing/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: integration.id,
          isEnabled: !integration.isEnabled,
        }),
      });
      if (res.ok) {
        fetchIntegrations();
      }
    } catch (error) {
      console.error("Error toggling integration:", error);
    }
  }

  const currentProviderInfo = formData.provider
    ? PROVIDER_INFO[formData.provider as keyof typeof PROVIDER_INFO]
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing</h1>
          <p className="text-gray-600">Manage integrations and remarketing</p>
        </div>
        <button
          onClick={fetchIntegrations}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {[
            { id: "integrations", label: "Integrations", icon: Webhook },
            { id: "settings", label: "Remarketing Settings", icon: Settings },
            { id: "activity", label: "Sync Activity", icon: Activity },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-1 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-teal-600 text-teal-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {activeTab === "integrations" && (
        <div className="space-y-6">
          {/* Add Integration Buttons */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Add Integration</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => openCreateModal(key)}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-teal-500 hover:bg-teal-50 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-full ${info.color} flex items-center justify-center`}>
                    <info.icon className="w-5 h-5" />
                  </div>
                  <span className="font-medium text-gray-900">{info.name}</span>
                  <span className="text-xs text-gray-500 text-center">{info.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Existing Integrations */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Active Integrations</h3>
            </div>
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : integrations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Megaphone className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>No integrations configured</p>
                <p className="text-sm">Add an integration above to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {integrations.map((integration) => {
                  const info = PROVIDER_INFO[integration.provider];
                  return (
                    <div key={integration.id} className="p-4 flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full ${info.color} flex items-center justify-center`}>
                        <info.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{integration.name}</span>
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full ${
                              integration.isEnabled
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {integration.isEnabled ? "Active" : "Disabled"}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            {integration.syncStats.success} synced
                          </span>
                          {integration.syncStats.failed > 0 && (
                            <span className="flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-red-500" />
                              {integration.syncStats.failed} failed
                            </span>
                          )}
                          {integration.syncStats.pending > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-yellow-500" />
                              {integration.syncStats.pending} pending
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleEnabled(integration)}
                          className={`p-2 rounded-lg ${
                            integration.isEnabled
                              ? "text-green-600 hover:bg-green-50"
                              : "text-gray-400 hover:bg-gray-100"
                          }`}
                          title={integration.isEnabled ? "Disable" : "Enable"}
                        >
                          {integration.isEnabled ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <X className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => openEditModal(integration)}
                          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(integration.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-6">Remarketing Settings</h3>
          <div className="space-y-6 max-w-lg">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900">Enable Remarketing</label>
                <p className="text-sm text-gray-500">
                  Send follow-up messages to abandoned quote submissions
                </p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, remarketingEnabled: !settings.remarketingEnabled })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.remarketingEnabled ? "bg-teal-600" : "bg-gray-300"
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                    settings.remarketingEnabled ? "translate-x-6" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block font-medium text-gray-900 mb-2">
                Max Remarketing Messages
              </label>
              <p className="text-sm text-gray-500 mb-2">
                Maximum number of follow-up messages to send per abandoned session
              </p>
              <select
                value={settings.remarketingMaxMessages}
                onChange={(e) =>
                  setSettings({ ...settings, remarketingMaxMessages: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value={1}>1 message</option>
                <option value={2}>2 messages</option>
                <option value={3}>3 messages</option>
              </select>
            </div>

            <div className="pt-4">
              <button
                onClick={saveSettings}
                disabled={saving}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "activity" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Sync Activity</h3>
          <p className="text-gray-500 text-sm">
            Sync activity logs are available in the database. Implementation of activity view coming soon.
          </p>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              Total synced across all integrations:{" "}
              <span className="font-semibold">
                {integrations.reduce((acc, i) => acc + i.syncStats.success, 0)}
              </span>
            </p>
            <p className="text-sm text-gray-600">
              Total failed:{" "}
              <span className="font-semibold text-red-600">
                {integrations.reduce((acc, i) => acc + i.syncStats.failed, 0)}
              </span>
            </p>
            <p className="text-sm text-gray-600">
              Pending:{" "}
              <span className="font-semibold text-yellow-600">
                {integrations.reduce((acc, i) => acc + i.syncStats.pending, 0)}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && currentProviderInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full ${currentProviderInfo.color} flex items-center justify-center`}
                >
                  <currentProviderInfo.icon className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-gray-900">
                  {editingIntegration ? "Edit" : "Add"} {currentProviderInfo.name}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Integration name"
                />
              </div>

              {currentProviderInfo.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <input
                    type={field.type}
                    value={(formData.config[field.key] as string) || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        config: { ...formData.config, [field.key]: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder={field.label}
                  />
                </div>
              ))}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isEnabled"
                  checked={formData.isEnabled}
                  onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <label htmlFor="isEnabled" className="text-sm text-gray-700">
                  Enable this integration
                </label>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
