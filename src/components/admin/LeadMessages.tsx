"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, MessageSquare, AlertCircle } from "lucide-react";

interface LeadMessage {
  id: string;
  createdAt: string;
  direction: string; // INBOUND | OUTBOUND
  body: string;
  status: string | null;
  adminEmail: string | null;
}

interface Template {
  id: string;
  name: string;
  body: string;
}

interface LeadMessagesProps {
  leadId: string;
  leadType: "quote" | "outofarea" | "career" | "commercial" | "adlead";
  phone: string | null;
  initialMessages: LeadMessage[];
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LeadMessages({ leadId, leadType, phone, initialMessages }: LeadMessagesProps) {
  const [messages, setMessages] = useState<LeadMessage[]>(initialMessages);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    const res = await fetch(`/api/admin/lead-messages?leadId=${leadId}&leadType=${leadType}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages || []);
    }
  }, [leadId, leadType]);

  // Load templates once; poll the thread for inbound replies.
  useEffect(() => {
    fetch("/api/admin/message-templates")
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => setTemplates(d.templates || []))
      .catch(() => {});
    const interval = setInterval(fetchMessages, 20000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [messages]);

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (t) setBody(t.body);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/lead-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, leadType, body: body.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setBody("");
        if (data.sent === false) {
          setError(data.error || "Message logged but not delivered (check Quo setup).");
        }
        await fetchMessages();
      } else {
        setError(data.error || "Failed to send message");
      }
    } catch {
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-teal-600" />
        <h2 className="text-lg font-semibold text-navy-900">Messages</h2>
      </div>

      {!phone && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          <AlertCircle className="w-4 h-4" />
          No phone number on file — add one to text this lead.
        </div>
      )}

      {/* Thread */}
      <div ref={feedRef} className="max-h-96 overflow-y-auto space-y-2 mb-4 pr-1">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No messages yet</p>
        ) : (
          messages.map((m) => {
            const outbound = m.direction === "OUTBOUND";
            return (
              <div key={m.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] ${outbound ? "items-end" : "items-start"} flex flex-col`}>
                  <div
                    className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                      outbound
                        ? "bg-teal-600 text-white rounded-br-sm"
                        : "bg-gray-100 text-gray-800 rounded-bl-sm"
                    }`}
                  >
                    {m.body}
                  </div>
                  <span className="text-[11px] text-gray-400 mt-0.5 px-1">
                    {formatTime(m.createdAt)}
                    {outbound && m.status ? ` · ${m.status.toLowerCase()}` : ""}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Compose */}
      <form onSubmit={handleSend}>
        <div className="border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-transparent">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={phone ? "Type a message…  (use {{firstName}} to personalize)" : "Add a phone number first"}
            rows={3}
            disabled={!phone}
            className="w-full px-4 py-3 text-sm resize-none border-0 focus:ring-0 focus:outline-none disabled:bg-gray-50"
          />
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Template:</span>
              <select
                onChange={(e) => {
                  applyTemplate(e.target.value);
                  e.target.value = "";
                }}
                defaultValue=""
                disabled={templates.length === 0}
                className="text-sm border-0 bg-transparent focus:ring-0 focus:outline-none text-gray-700 cursor-pointer py-0 pl-0 pr-6 disabled:text-gray-400"
              >
                <option value="" disabled>
                  {templates.length ? "Insert…" : "No templates"}
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={!phone || !body.trim() || sending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
