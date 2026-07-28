"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Bell, AlertTriangle, Info, XCircle, Check } from "lucide-react";

interface Note {
  id: string;
  type: string;
  severity: "info" | "warning" | "error" | string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

const ICON: Record<string, typeof Info> = { info: Info, warning: AlertTriangle, error: XCircle };
const TONE: Record<string, string> = {
  info: "text-blue-500",
  warning: "text-amber-500",
  error: "text-red-500",
};

function ago(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications");
      if (!res.ok) return;
      const d = await res.json();
      setNotes(d.notifications || []);
      setUnread(d.unread || 0);
    } catch {
      /* offline — try again on the next tick */
    }
  }, []);

  // Poll so things that happen server-side (a failed text, a call becoming a
  // lead) surface without a page refresh.
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled) void load();
    };
    // Defer the first fetch out of the effect body so we don't setState during
    // the synchronous effect pass.
    const first = setTimeout(tick, 0);
    const repeat = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(repeat);
    };
  }, [load]);

  // Close when clicking outside the panel.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function markAllRead() {
    setUnread(0);
    setNotes((p) => p.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
  }

  async function markRead(id: string) {
    setNotes((p) => p.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, u - 1));
    await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="text-sm font-semibold text-navy-900">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-teal-600 hover:underline flex items-center gap-1">
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {notes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Nothing to report.</p>
            ) : (
              notes.map((n) => {
                const Icon = ICON[n.severity] || Info;
                const inner = (
                  <div className={`flex gap-3 px-4 py-3 ${n.readAt ? "" : "bg-teal-50/40"}`}>
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${TONE[n.severity] || "text-gray-400"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-navy-900 font-medium leading-snug">{n.title}</p>
                      {n.body && <p className="text-xs text-gray-600 mt-0.5 break-words">{n.body}</p>}
                      <p className="text-[11px] text-gray-400 mt-1" suppressHydrationWarning>{ago(n.createdAt)}</p>
                    </div>
                    {!n.readAt && <span className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />}
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => { markRead(n.id); setOpen(false); }} className="block hover:bg-gray-50">
                    {inner}
                  </Link>
                ) : (
                  <button key={n.id} onClick={() => markRead(n.id)} className="block w-full text-left hover:bg-gray-50">
                    {inner}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
