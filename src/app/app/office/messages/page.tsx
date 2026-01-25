"use client";

import { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Mail,
  Search,
  Send,
  User,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  ChevronLeft,
  RefreshCw,
  MoreVertical,
  UserPlus,
} from "lucide-react";

interface ConversationStats {
  open: number;
  closed: number;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface Conversation {
  id: string;
  channel: "SMS" | "EMAIL";
  status: "OPEN" | "CLOSED";
  unreadCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  client: {
    id: string;
    name: string;
    email: string;
    phone: string;
  } | null;
  lastMessage: {
    body: string;
    direction: "INBOUND" | "OUTBOUND";
    created_at: string;
  } | null;
  assignedTo?: {
    id: string;
    name: string;
  } | null;
}

interface Message {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  status: string;
  sentBy: string | null;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  channel: "SMS" | "EMAIL";
  status: string;
  client: {
    id: string;
    name: string;
    email: string;
    phone: string;
  } | null;
  assignedTo?: {
    id: string;
    name: string;
  } | null;
}

export default function MessagesPage() {
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<ConversationStats>({ open: 0, closed: 0 });
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [channelFilter, setChannelFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [showAssignMenu, setShowAssignMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
    fetchStaffMembers();
  }, [statusFilter, channelFilter]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function fetchConversations() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (channelFilter) params.set("channel", channelFilter);

      const res = await fetch(`/api/messages/conversations?${params}`);
      const data = await res.json();

      if (res.ok) {
        setConversations(data.conversations || []);
        setStats(data.stats || { open: 0, closed: 0 });
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStaffMembers() {
    try {
      const res = await fetch("/api/staff");
      const data = await res.json();
      if (res.ok) {
        setStaffMembers(
          (data.staff || []).map((s: { id: string; first_name: string; last_name: string; role: string }) => ({
            id: s.id,
            name: `${s.first_name} ${s.last_name}`,
            role: s.role,
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching staff:", error);
    }
  }

  async function assignStaff(staffId: string | null) {
    if (!selectedConversation) return;

    try {
      const res = await fetch(`/api/messages/conversations/${selectedConversation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignToStaffId: staffId }),
      });

      if (res.ok) {
        const assignedStaff = staffId
          ? staffMembers.find((s) => s.id === staffId)
          : null;
        setSelectedConversation({
          ...selectedConversation,
          assignedTo: assignedStaff ? { id: assignedStaff.id, name: assignedStaff.name } : null,
        });
        fetchConversations();
      }
    } catch (error) {
      console.error("Error assigning staff:", error);
    }
    setShowAssignMenu(false);
  }

  async function fetchMessages(conversationId: string) {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/messages/conversations/${conversationId}`);
      const data = await res.json();

      if (res.ok) {
        setSelectedConversation(data.conversation);
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedConversation) return;

    setSending(true);
    try {
      const res = await fetch(`/api/messages/conversations/${selectedConversation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMessage }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessages([...messages, data.message]);
        setNewMessage("");
        fetchConversations(); // Refresh list
      } else {
        alert(data.error || "Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function updateConversationStatus(status: string) {
    if (!selectedConversation) return;

    try {
      const res = await fetch(`/api/messages/conversations/${selectedConversation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setSelectedConversation({ ...selectedConversation, status });
        fetchConversations();
      }
    } catch (error) {
      console.error("Error updating conversation:", error);
    }
  }

  const filteredConversations = conversations.filter((c) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        c.client?.name.toLowerCase().includes(query) ||
        c.client?.phone.toLowerCase().includes(query) ||
        c.client?.email.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-600">Customer conversations</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {stats.open} open, {stats.closed} closed
          </span>
          <button
            onClick={fetchConversations}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Conversations List */}
        <div className="w-80 border-r border-gray-100 flex flex-col">
          {/* Filters */}
          <div className="p-3 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 text-sm px-2 py-1.5 border border-gray-200 rounded-lg"
              >
                <option value="OPEN">Open</option>
                <option value="CLOSED">Closed</option>
                <option value="ALL">All</option>
              </select>
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="flex-1 text-sm px-2 py-1.5 border border-gray-200 rounded-lg"
              >
                <option value="">All Channels</option>
                <option value="SMS">SMS</option>
                <option value="EMAIL">Email</option>
              </select>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No conversations</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => fetchMessages(conv.id)}
                  className={`w-full p-3 text-left border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    selectedConversation?.id === conv.id ? "bg-teal-50" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 relative">
                      {conv.channel === "SMS" ? (
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Phone className="w-5 h-5 text-blue-600" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <Mail className="w-5 h-5 text-purple-600" />
                        </div>
                      )}
                      {conv.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900 truncate">
                          {conv.client?.name || "Unknown"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {conv.lastMessageAt
                            ? new Date(conv.lastMessageAt).toLocaleDateString()
                            : ""}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {conv.lastMessage ? (
                          <>
                            {conv.lastMessage.direction === "OUTBOUND" && (
                              <span className="text-gray-400">You: </span>
                            )}
                            {conv.lastMessage.body}
                          </>
                        ) : (
                          <span className="text-gray-400">No messages yet</span>
                        )}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {selectedConversation.client?.name || "Unknown"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {selectedConversation.channel === "SMS"
                        ? selectedConversation.client?.phone
                        : selectedConversation.client?.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Assigned Staff */}
                  <div className="relative">
                    <button
                      onClick={() => setShowAssignMenu(!showAssignMenu)}
                      className="flex items-center gap-1 px-2 py-1 text-sm rounded-lg hover:bg-gray-100"
                    >
                      {selectedConversation.assignedTo ? (
                        <>
                          <User className="w-4 h-4 text-teal-600" />
                          <span className="text-gray-700">{selectedConversation.assignedTo.name}</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-500">Assign</span>
                        </>
                      )}
                    </button>
                    {showAssignMenu && (
                      <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 z-20">
                        <div className="p-2 border-b border-gray-100">
                          <span className="text-xs font-medium text-gray-500">Assign to staff</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {selectedConversation.assignedTo && (
                            <button
                              onClick={() => assignStaff(null)}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              Unassign
                            </button>
                          )}
                          {staffMembers
                            .filter((s) => ["OWNER", "MANAGER", "OFFICE"].includes(s.role))
                            .map((staff) => (
                              <button
                                key={staff.id}
                                onClick={() => assignStaff(staff.id)}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                                  selectedConversation.assignedTo?.id === staff.id
                                    ? "bg-teal-50 text-teal-700"
                                    : "text-gray-700"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4" />
                                  <span>{staff.name}</span>
                                </div>
                                <span className="text-xs text-gray-400 ml-6">{staff.role}</span>
                              </button>
                            ))}
                          {staffMembers.filter((s) => ["OWNER", "MANAGER", "OFFICE"].includes(s.role)).length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-500">No staff available</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      selectedConversation.status === "OPEN"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {selectedConversation.status}
                  </span>
                  <div className="relative group">
                    <button className="p-2 hover:bg-gray-100 rounded-lg">
                      <MoreVertical className="w-5 h-5 text-gray-500" />
                    </button>
                    <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-100 hidden group-hover:block z-10">
                      {selectedConversation.status === "OPEN" ? (
                        <button
                          onClick={() => updateConversationStatus("CLOSED")}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Close Conversation
                        </button>
                      ) : (
                        <button
                          onClick={() => updateConversationStatus("OPEN")}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Reopen Conversation
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <p>No messages in this conversation</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.direction === "OUTBOUND" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                          msg.direction === "OUTBOUND"
                            ? "bg-teal-600 text-white"
                            : "bg-gray-100 text-gray-900"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.body}</p>
                        <div
                          className={`flex items-center gap-1 mt-1 text-xs ${
                            msg.direction === "OUTBOUND" ? "text-teal-200" : "text-gray-500"
                          }`}
                        >
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {msg.direction === "OUTBOUND" && (
                            <>
                              {msg.status === "SENT" || msg.status === "DELIVERED" ? (
                                <CheckCircle className="w-3 h-3" />
                              ) : msg.status === "FAILED" ? (
                                <XCircle className="w-3 h-3 text-red-300" />
                              ) : (
                                <Clock className="w-3 h-3" />
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-100">
                <div className="flex items-end gap-2">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder={`Send ${selectedConversation.channel === "SMS" ? "SMS" : "email"}...`}
                    rows={2}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="p-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? (
                      <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
