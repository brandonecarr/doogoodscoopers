"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  Mail,
  MessageSquare,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  AlertCircle,
  ChevronRight,
  FileText,
  Forward,
  Plus,
  Trash2,
  Edit3,
  Save,
  Loader2,
} from "lucide-react";

interface NotificationStats {
  pending: number;
  sent: number;
  delivered: number;
  failed: number;
}

interface Notification {
  id: string;
  channel: "SMS" | "EMAIL";
  recipient: string;
  subject: string | null;
  body: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
  client: {
    id: string;
    name: string;
  } | null;
  templateType: string | null;
  templateName: string | null;
  errorMessage: string | null;
}

interface NotificationTemplate {
  id: string;
  type: string;
  channel: "SMS" | "EMAIL";
  name: string;
  subject: string | null;
  body: string;
  isEnabled: boolean;
  variables: string[];
}

interface ForwardingRule {
  id: string;
  name: string;
  forwardToType: "EMAIL" | "SMS" | "WEBHOOK";
  forwardToValue: string;
  conditions: Record<string, unknown> | null;
  isEnabled: boolean;
}

type Tab = "history" | "templates" | "forwarding";

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("history");
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [forwardingRules, setForwardingRules] = useState<ForwardingRule[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    pending: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
  });
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Template editing
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);

  // Forwarding rule modal
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<ForwardingRule | null>(null);
  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState<"EMAIL" | "SMS" | "WEBHOOK">("EMAIL");
  const [ruleValue, setRuleValue] = useState("");

  useEffect(() => {
    if (activeTab === "history") {
      fetchNotifications();
    } else if (activeTab === "templates") {
      fetchTemplates();
    } else {
      fetchForwardingRules();
    }
  }, [activeTab, statusFilter, channelFilter]);

  async function fetchNotifications() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (channelFilter) params.set("channel", channelFilter);

      const res = await fetch(`/api/notifications?${params}`);
      const data = await res.json();

      if (res.ok) {
        setNotifications(data.notifications || []);
        setStats(data.stats || { pending: 0, sent: 0, delivered: 0, failed: 0 });
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTemplates() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications/templates");
      const data = await res.json();

      if (res.ok) {
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchForwardingRules() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications/forwarding-rules");
      const data = await res.json();

      if (res.ok) {
        setForwardingRules(data.rules || []);
      }
    } catch (error) {
      console.error("Error fetching forwarding rules:", error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleTemplate(template: NotificationTemplate) {
    try {
      const res = await fetch("/api/notifications/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: template.id,
          isEnabled: !template.isEnabled,
        }),
      });

      if (res.ok) {
        fetchTemplates();
        if (selectedTemplate?.id === template.id) {
          setSelectedTemplate({ ...selectedTemplate, isEnabled: !template.isEnabled });
        }
      }
    } catch (error) {
      console.error("Error toggling template:", error);
    }
  }

  async function saveTemplate() {
    if (!selectedTemplate) return;

    setSaving(true);
    try {
      const res = await fetch("/api/notifications/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          subject: editSubject || null,
          templateBody: editBody,
        }),
      });

      if (res.ok) {
        fetchTemplates();
        setEditingTemplate(false);
        setSelectedTemplate({
          ...selectedTemplate,
          subject: editSubject || null,
          body: editBody,
        });
      }
    } catch (error) {
      console.error("Error saving template:", error);
    } finally {
      setSaving(false);
    }
  }

  async function saveForwardingRule() {
    setSaving(true);
    try {
      const method = editingRule ? "PUT" : "POST";
      const body = editingRule
        ? { ruleId: editingRule.id, name: ruleName, forwardToType: ruleType, forwardToValue: ruleValue }
        : { name: ruleName, forwardToType: ruleType, forwardToValue: ruleValue };

      const res = await fetch("/api/notifications/forwarding-rules", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        fetchForwardingRules();
        closeRuleModal();
      }
    } catch (error) {
      console.error("Error saving forwarding rule:", error);
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule: ForwardingRule) {
    try {
      const res = await fetch("/api/notifications/forwarding-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleId: rule.id,
          isEnabled: !rule.isEnabled,
        }),
      });

      if (res.ok) {
        fetchForwardingRules();
      }
    } catch (error) {
      console.error("Error toggling rule:", error);
    }
  }

  async function deleteRule(ruleId: string) {
    if (!confirm("Delete this forwarding rule?")) return;

    try {
      const res = await fetch(`/api/notifications/forwarding-rules?id=${ruleId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchForwardingRules();
      }
    } catch (error) {
      console.error("Error deleting rule:", error);
    }
  }

  function openRuleModal(rule?: ForwardingRule) {
    if (rule) {
      setEditingRule(rule);
      setRuleName(rule.name);
      setRuleType(rule.forwardToType);
      setRuleValue(rule.forwardToValue);
    } else {
      setEditingRule(null);
      setRuleName("");
      setRuleType("EMAIL");
      setRuleValue("");
    }
    setShowRuleModal(true);
  }

  function closeRuleModal() {
    setShowRuleModal(false);
    setEditingRule(null);
    setRuleName("");
    setRuleType("EMAIL");
    setRuleValue("");
  }

  function openTemplateEdit() {
    if (!selectedTemplate) return;
    setEditSubject(selectedTemplate.subject || "");
    setEditBody(selectedTemplate.body);
    setEditingTemplate(true);
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "SENT":
      case "DELIVERED":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "FAILED":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "PENDING":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SENT":
      case "DELIVERED":
        return "bg-green-100 text-green-800";
      case "FAILED":
        return "bg-red-100 text-red-800";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        n.recipient.toLowerCase().includes(query) ||
        n.body.toLowerCase().includes(query) ||
        n.client?.name.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600">Manage templates, forwarding rules, and view history</p>
        </div>
        <button
          onClick={() => {
            if (activeTab === "history") fetchNotifications();
            else if (activeTab === "templates") fetchTemplates();
            else fetchForwardingRules();
          }}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              <p className="text-sm text-gray-500">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.sent}</p>
              <p className="text-sm text-gray-500">Sent (24h)</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.delivered}</p>
              <p className="text-sm text-gray-500">Delivered</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.failed}</p>
              <p className="text-sm text-gray-500">Failed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab("history")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "history"
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              History
            </div>
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "templates"
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Templates
            </div>
          </button>
          <button
            onClick={() => setActiveTab("forwarding")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "forwarding"
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <Forward className="w-4 h-4" />
              Forwarding Rules
            </div>
          </button>
        </nav>
      </div>

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notifications..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="SENT">Sent</option>
              <option value="DELIVERED">Delivered</option>
              <option value="FAILED">Failed</option>
            </select>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="">All Channels</option>
              <option value="SMS">SMS</option>
              <option value="EMAIL">Email</option>
            </select>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No notifications found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredNotifications.map((notification) => (
                  <div key={notification.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        {notification.channel === "SMS" ? (
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-blue-600" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Mail className="w-5 h-5 text-purple-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusIcon(notification.status)}
                          <span className="font-medium text-gray-900">
                            {notification.client?.name || notification.recipient}
                          </span>
                          {notification.templateType && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                              {notification.templateType.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">{notification.body}</p>
                        {notification.errorMessage && (
                          <p className="text-xs text-red-600 mt-1">{notification.errorMessage}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>{notification.recipient}</span>
                          <span>{new Date(notification.createdAt).toLocaleString()}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(notification.status)}`}>
                            {notification.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : templates.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No templates found</p>
                <p className="text-sm mt-2">Run the seed script to create default templates.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setEditingTemplate(false);
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        {template.channel === "SMS" ? (
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-blue-600" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Mail className="w-5 h-5 text-purple-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">{template.name}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {template.type.replace(/_/g, " ")}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              template.isEnabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {template.isEnabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{template.body}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Forwarding Rules Tab */}
      {activeTab === "forwarding" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => openRuleModal()}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <Plus className="w-4 h-4" />
              Add Rule
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : forwardingRules.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Forward className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No forwarding rules</p>
                <p className="text-sm mt-2">Create a rule to forward inbound messages.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {forwardingRules.map((rule) => (
                  <div key={rule.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <Forward className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">{rule.name}</span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              rule.isEnabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {rule.isEnabled ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Forward to {rule.forwardToType}: {rule.forwardToValue}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleRule(rule)}
                          className={`px-3 py-1.5 text-sm rounded-lg ${
                            rule.isEnabled
                              ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              : "bg-teal-100 text-teal-700 hover:bg-teal-200"
                          }`}
                        >
                          {rule.isEnabled ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => openRuleModal(rule)}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteRule(rule.id)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Template Detail/Edit Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">{selectedTemplate.name}</h2>
                <button onClick={() => setSelectedTemplate(null)} className="text-gray-400 hover:text-gray-600">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <span
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedTemplate.channel === "SMS" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                  }`}
                >
                  {selectedTemplate.channel}
                </span>
                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                  {selectedTemplate.type.replace(/_/g, " ")}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedTemplate.isEnabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {selectedTemplate.isEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>

              {selectedTemplate.channel === "EMAIL" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  {editingTemplate ? (
                    <input
                      type="text"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  ) : (
                    <p className="text-gray-900 bg-gray-50 rounded-lg p-3">
                      {selectedTemplate.subject || "(No subject)"}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message Body</label>
                {editingTemplate ? (
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono text-sm"
                  />
                ) : (
                  <pre className="text-gray-900 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap font-sans text-sm">
                    {selectedTemplate.body}
                  </pre>
                )}
              </div>

              {selectedTemplate.variables.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Available Variables</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.variables.map((v) => (
                      <button
                        key={v}
                        onClick={() => {
                          if (editingTemplate) {
                            setEditBody(editBody + `{{${v}}}`);
                          }
                        }}
                        className={`text-sm bg-teal-50 text-teal-700 px-2 py-1 rounded ${
                          editingTemplate ? "hover:bg-teal-100 cursor-pointer" : ""
                        }`}
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                  {editingTemplate && (
                    <p className="text-xs text-gray-500 mt-1">Click a variable to insert it into the body</p>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-between">
              <button
                onClick={() => toggleTemplate(selectedTemplate)}
                className={`px-4 py-2 rounded-lg ${
                  selectedTemplate.isEnabled
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-green-100 text-green-700 hover:bg-green-200"
                }`}
              >
                {selectedTemplate.isEnabled ? "Disable" : "Enable"}
              </button>
              <div className="flex gap-3">
                {editingTemplate ? (
                  <>
                    <button
                      onClick={() => setEditingTemplate(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveTemplate}
                      disabled={saving}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Changes
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setSelectedTemplate(null)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Close
                    </button>
                    <button
                      onClick={openTemplateEdit}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit Template
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forwarding Rule Modal */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editingRule ? "Edit Forwarding Rule" : "New Forwarding Rule"}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g., Forward to Office Email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Forward Type</label>
                <select
                  value={ruleType}
                  onChange={(e) => setRuleType(e.target.value as "EMAIL" | "SMS" | "WEBHOOK")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="WEBHOOK">Webhook URL</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {ruleType === "EMAIL" ? "Email Address" : ruleType === "SMS" ? "Phone Number" : "Webhook URL"}
                </label>
                <input
                  type={ruleType === "EMAIL" ? "email" : "text"}
                  value={ruleValue}
                  onChange={(e) => setRuleValue(e.target.value)}
                  placeholder={
                    ruleType === "EMAIL"
                      ? "office@company.com"
                      : ruleType === "SMS"
                      ? "+1234567890"
                      : "https://..."
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={closeRuleModal} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Cancel
              </button>
              <button
                onClick={saveForwardingRule}
                disabled={saving || !ruleName || !ruleValue}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingRule ? "Save Changes" : "Create Rule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
