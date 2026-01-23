"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, MessageSquare, Mail, User, MoreHorizontal, Send } from "lucide-react";

interface LeadUpdate {
  id: string;
  createdAt: string;
  message: string;
  communicationType: string;
  adminEmail: string;
}

interface LeadUpdatesProps {
  leadId: string;
  leadType: "quote" | "outofarea" | "career" | "commercial" | "adlead";
  updates: LeadUpdate[];
}

const communicationTypes = [
  { value: "phone_call", label: "Phone Call", icon: Phone },
  { value: "text_message", label: "Text Message", icon: MessageSquare },
  { value: "email", label: "Email", icon: Mail },
  { value: "in_person", label: "In Person", icon: User },
  { value: "other", label: "Other", icon: MoreHorizontal },
];

function formatUpdateDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getCommunicationIcon(type: string) {
  const commType = communicationTypes.find((t) => t.value === type);
  return commType?.icon || MoreHorizontal;
}

function getCommunicationLabel(type: string) {
  const commType = communicationTypes.find((t) => t.value === type);
  return commType?.label || "Other";
}

export function LeadUpdates({ leadId, leadType, updates }: LeadUpdatesProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [communicationType, setCommunicationType] = useState("phone_call");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/lead-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          leadType,
          message: message.trim(),
          communicationType,
        }),
      });

      if (response.ok) {
        setMessage("");
        router.refresh();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to add update");
      }
    } catch {
      alert("Failed to add update");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-navy-900 mb-4">Updates</h2>

      {/* Add Update Form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-transparent">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add an update..."
            rows={3}
            className="w-full px-4 py-3 text-sm resize-none border-0 focus:ring-0 focus:outline-none"
          />
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Type:</span>
              <select
                value={communicationType}
                onChange={(e) => setCommunicationType(e.target.value)}
                className="text-sm border-0 bg-transparent focus:ring-0 focus:outline-none text-gray-700 cursor-pointer py-0 pl-0 pr-6"
              >
                {communicationTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={!message.trim() || isSubmitting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      </form>

      {/* Updates List */}
      {updates.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No updates yet</p>
      ) : (
        <div className="space-y-4">
          {updates.map((update) => {
            const Icon = getCommunicationIcon(update.communicationType);
            return (
              <div key={update.id} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-900">
                      {getCommunicationLabel(update.communicationType)}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">
                      {formatUpdateDate(update.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{update.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{update.adminEmail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
