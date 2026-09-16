"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Loader2, X, Trash2,
  Clock, MapPin, CalendarClock, LayoutGrid, List as ListIcon,
} from "lucide-react";
import { PageHero, heroBtnPrimary, heroPrimaryStyle } from "@/components/admin/PageHero";
import { LeadsSectionSwitch } from "@/components/admin/LeadsSectionSwitch";

// ─── Types (mirrors /api/admin/calendar) ───────────────────────────────────────
interface CalendarEvent {
  id: string;
  kind: "followup" | "manual";
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  leadType?: string;
  href?: string;
  status?: string | null;
  grade?: string | null;
  subtitle?: string | null;
  notes?: string | null;
  location?: string | null;
  color?: string | null;
}

// ─── Colors ─────────────────────────────────────────────────────────────────--
// Lead follow-ups are colored by lead type; manual entries pick from this palette.
interface Swatch { dot: string; bg: string; text: string }
const PALETTE: Record<string, Swatch> = {
  violet: { dot: "#8B6BFF", bg: "#EFEBFF", text: "#5B37C7" },
  blue:   { dot: "#2563EB", bg: "#E7F0FF", text: "#1E48B5" },
  green:  { dot: "#12A150", bg: "#E4F7EC", text: "#0B7539" },
  amber:  { dot: "#D97706", bg: "#FDF0DC", text: "#9A5A05" },
  red:    { dot: "#DC2626", bg: "#FCE8E8", text: "#A81C1C" },
  teal:   { dot: "#0D9488", bg: "#DDF5F2", text: "#0A6C63" },
  pink:   { dot: "#DB2777", bg: "#FCE7F1", text: "#A81B5D" },
  gray:   { dot: "#64748B", bg: "#EEF1F5", text: "#475569" },
};
const PALETTE_KEYS = Object.keys(PALETTE);

const LEAD_COLOR: Record<string, string> = {
  quote: "blue", adlead: "pink", instagram: "violet",
  canvasser: "amber", commercial: "green", prospect: "teal",
};
const LEAD_LABEL: Record<string, string> = {
  quote: "Residential quote", adlead: "Meta ad", instagram: "Instagram",
  canvasser: "Canvasser", commercial: "Commercial", prospect: "Call list",
};

function swatchFor(ev: CalendarEvent): Swatch {
  if (ev.kind === "manual") return PALETTE[ev.color || "violet"] || PALETTE.violet;
  return PALETTE[LEAD_COLOR[ev.leadType || ""] || "gray"] || PALETTE.gray;
}

// ─── Date helpers (all local-time) ─────────────────────────────────────────────
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// A Date → "YYYY-MM-DDTHH:mm" in local time for <input type="datetime-local">.
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function toLocalDateInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(":00", "");

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Draft for the add/edit modal ──────────────────────────────────────────────
interface Draft {
  id: string | null;          // manual entry id when editing
  title: string;
  allDay: boolean;
  startAt: string;            // datetime-local or date string
  endAt: string;             // datetime-local or date string (optional)
  location: string;
  notes: string;
  color: string;
}

export function LeadsCalendar() {
  const router = useRouter();
  const [cursor, setCursor] = useState<Date>(() => startOfDay(new Date()));
  const [view, setView] = useState<"month" | "agenda">("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dayPeek, setDayPeek] = useState<Date | null>(null);
  const reqId = useRef(0);

  // Range covering everything the current view can show, so paging is seamless.
  const range = useMemo(() => {
    if (view === "agenda") {
      const from = startOfDay(new Date());
      return { from, to: addDays(from, 120) };
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = addDays(first, -first.getDay());
    return { from: gridStart, to: addDays(gridStart, 42) };
  }, [cursor, view]);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const url = `/api/admin/calendar?from=${range.from.toISOString()}&to=${range.to.toISOString()}`;
      const res = await fetch(url);
      const data = await res.json();
      if (id !== reqId.current) return; // a newer request superseded this one
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch {
      if (id === reqId.current) setEvents([]);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => { load(); }, [load]);

  // Bucket events by local day for the grid.
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const k = dayKey(new Date(ev.start));
      const arr = m.get(k);
      if (arr) arr.push(ev); else m.set(k, [ev]);
    }
    for (const arr of m.values()) arr.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return m;
  }, [events]);

  const monthCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [cursor]);

  const today = startOfDay(new Date());
  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // ── Modal open helpers ──
  const openCreate = (day?: Date) => {
    const base = day ? new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0) : new Date();
    if (!day) base.setMinutes(0);
    setError(null);
    setDraft({
      id: null, title: "", allDay: false,
      startAt: toLocalInput(base), endAt: "",
      location: "", notes: "", color: "violet",
    });
  };
  const openEdit = (ev: CalendarEvent) => {
    if (ev.kind !== "manual") return;
    const s = new Date(ev.start);
    setError(null);
    setDraft({
      id: ev.id.replace(/^manual:/, ""),
      title: ev.title,
      allDay: ev.allDay,
      startAt: ev.allDay ? toLocalDateInput(s) : toLocalInput(s),
      endAt: ev.end ? (ev.allDay ? toLocalDateInput(new Date(ev.end)) : toLocalInput(new Date(ev.end))) : "",
      location: ev.location || "",
      notes: ev.notes || "",
      color: ev.color || "violet",
    });
  };

  const onEventClick = (ev: CalendarEvent) => {
    if (ev.kind === "followup" && ev.href) router.push(ev.href);
    else openEdit(ev);
  };

  // ── Save / delete ──
  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim()) { setError("Give the entry a title."); return; }
    if (!draft.startAt) { setError("Pick a start date."); return; }
    setSaving(true); setError(null);
    // Build unambiguous ISO from the local input. All-day → noon local to dodge
    // any midnight/DST date-shift when it's read back.
    const startLocal = draft.allDay ? new Date(`${draft.startAt}T12:00`) : new Date(draft.startAt);
    let endISO: string | null = null;
    if (draft.endAt) {
      const endLocal = draft.allDay ? new Date(`${draft.endAt}T12:00`) : new Date(draft.endAt);
      endISO = endLocal.toISOString();
    }
    const payload = {
      title: draft.title.trim(),
      allDay: draft.allDay,
      startAt: startLocal.toISOString(),
      endAt: endISO,
      location: draft.location.trim() || null,
      notes: draft.notes.trim() || null,
      color: draft.color,
    };
    try {
      const res = draft.id
        ? await fetch(`/api/admin/calendar/${draft.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch(`/api/admin/calendar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Save failed"); }
      setDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!draft?.id) return;
    if (!confirm("Delete this calendar entry?")) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/admin/calendar/${draft.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  // Upcoming manual + followups for the agenda view, grouped by day.
  const agendaDays = useMemo(() => {
    const groups: { day: Date; items: CalendarEvent[] }[] = [];
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      if (new Date(ev.start) < today && !sameDay(new Date(ev.start), today)) continue;
      const k = dayKey(new Date(ev.start));
      const a = map.get(k); if (a) a.push(ev); else map.set(k, [ev]);
    }
    for (const [k, items] of map) {
      const [y, m, d] = k.split("-").map(Number);
      groups.push({ day: new Date(y, m - 1, d), items: items.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()) });
    }
    groups.sort((a, b) => a.day.getTime() - b.day.getTime());
    return groups;
  }, [events, today]);

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <PageHero
        title="Calendar"
        subtitle="Lead follow-ups land here automatically. Add your own reminders and appointments too."
        icon={<div className="w-11 h-11 rounded-[13px] flex items-center justify-center" style={{ background: "linear-gradient(150deg,#B79BFF,#6D3EF0)" }}><CalendarDays className="w-[22px] h-[22px] text-white" /></div>}
        actions={<>
          <LeadsSectionSwitch active="calendar" />
          <div className="flex items-center bg-white/10 rounded-[12px] p-1">
            {([{ v: "month", icon: LayoutGrid, label: "Month" }, { v: "agenda", icon: ListIcon, label: "Agenda" }] as const).map(({ v, icon: Icon, label }) => (
              <button key={v} onClick={() => setView(v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[13px] font-semibold transition-colors ${view === v ? "bg-white text-ink shadow-sm" : "text-white/70 hover:text-white"}`}>
                <Icon className="w-4 h-4" /><span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <button onClick={() => openCreate()} className={heroBtnPrimary} style={heroPrimaryStyle}><Plus className="w-4 h-4" /><span className="hidden sm:inline">Add entry</span></button>
        </>}
      />

      {/* Toolbar: month navigation + legend */}
      <div className="dgs-card p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {view === "month" ? (
            <>
              <button onClick={() => setCursor(addMonths(cursor, -1))} className="p-2 rounded-[10px] hover:bg-gray-100 transition-colors" aria-label="Previous month"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
              <div className="min-w-[170px] text-center text-[16px] font-extrabold text-ink">{monthLabel}</div>
              <button onClick={() => setCursor(addMonths(cursor, 1))} className="p-2 rounded-[10px] hover:bg-gray-100 transition-colors" aria-label="Next month"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
            </>
          ) : (
            <div className="text-[16px] font-extrabold text-ink flex items-center gap-2"><CalendarClock className="w-5 h-5 text-iris-link" /> Upcoming</div>
          )}
          <button onClick={() => setCursor(startOfDay(new Date()))} className="ml-1 px-3 py-1.5 rounded-[10px] text-[13px] font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">Today</button>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-1" />}
        </div>
        <div className="flex items-center gap-3 flex-wrap text-[11.5px]">
          {Object.entries(LEAD_LABEL).map(([k, label]) => (
            <span key={k} className="inline-flex items-center gap-1.5 text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: PALETTE[LEAD_COLOR[k]].dot }} />{label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-gray-500"><span className="w-2.5 h-2.5 rounded-full" style={{ background: PALETTE.violet.dot }} />Manual entry</span>
        </div>
      </div>

      {view === "month" ? (
        <div className="dgs-card overflow-hidden">
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-gray-400">
                <span className="sm:hidden">{d[0]}</span><span className="hidden sm:inline">{d}</span>
              </div>
            ))}
          </div>
          {/* 6 weeks */}
          <div className="grid grid-cols-7 grid-rows-6" style={{ minHeight: "calc(100vh - 300px)" }}>
            {monthCells.map((day, i) => {
              const inMonth = day.getMonth() === cursor.getMonth();
              const isToday = sameDay(day, today);
              const list = byDay.get(dayKey(day)) || [];
              const shown = list.slice(0, 4);
              const extra = list.length - shown.length;
              return (
                <div
                  key={i}
                  onClick={() => openCreate(day)}
                  className={`group relative border-b border-r border-gray-100 p-1.5 flex flex-col gap-1 cursor-pointer transition-colors ${inMonth ? "bg-white hover:bg-violet-50/40" : "bg-gray-50/60"} ${i % 7 === 6 ? "border-r-0" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center justify-center text-[12.5px] font-semibold h-6 min-w-6 px-1 rounded-full ${isToday ? "bg-iris-link text-white" : inMonth ? "text-gray-700" : "text-gray-400"}`}>{day.getDate()}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); openCreate(day); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-violet-100 transition-opacity"
                      aria-label="Add entry"
                    ><Plus className="w-3.5 h-3.5 text-iris-link" /></button>
                  </div>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {shown.map((ev) => {
                      const sw = swatchFor(ev);
                      return (
                        <button
                          key={ev.id}
                          onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                          title={`${ev.title}${ev.subtitle ? ` — ${ev.subtitle}` : ""}`}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] text-left w-full hover:brightness-95 transition"
                          style={{ background: sw.bg, color: sw.text }}
                        >
                          {!ev.allDay && <span className="text-[10px] font-bold tabular-nums flex-shrink-0 opacity-80">{timeLabel(ev.start)}</span>}
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sw.dot }} />
                          <span className="text-[11px] font-semibold truncate">{ev.title}</span>
                        </button>
                      );
                    })}
                    {extra > 0 && (
                      <button onClick={(e) => { e.stopPropagation(); setDayPeek(day); }} className="text-[10.5px] font-semibold text-gray-500 hover:text-iris-link text-left px-1.5">+{extra} more</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // ── Agenda view ──
        <div className="dgs-card p-4 sm:p-6">
          {agendaDays.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="font-semibold text-gray-500">Nothing scheduled</p>
              <p className="text-sm mt-1">Follow-ups you set on leads and any entries you add will show up here.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {agendaDays.map(({ day, items }) => (
                <div key={dayKey(day)} className="flex gap-4">
                  <div className="w-14 flex-shrink-0 text-center">
                    <div className={`text-[11px] font-bold uppercase ${sameDay(day, today) ? "text-iris-link" : "text-gray-400"}`}>{day.toLocaleDateString("en-US", { weekday: "short" })}</div>
                    <div className={`text-[22px] font-extrabold leading-tight ${sameDay(day, today) ? "text-iris-link" : "text-ink"}`}>{day.getDate()}</div>
                    <div className="text-[10px] text-gray-400">{day.toLocaleDateString("en-US", { month: "short" })}</div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5 border-l border-gray-100 pl-4">
                    {items.map((ev) => {
                      const sw = swatchFor(ev);
                      return (
                        <button key={ev.id} onClick={() => onEventClick(ev)} className="w-full flex items-center gap-3 p-2.5 rounded-[12px] border border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-left transition">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: sw.dot }} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[13.5px] font-semibold text-ink truncate">{ev.title}</div>
                            <div className="text-[11.5px] text-gray-500 truncate">
                              {ev.kind === "followup" ? (ev.subtitle || "Follow-up") : (ev.location || "Manual entry")}
                            </div>
                          </div>
                          <div className="text-[11.5px] font-semibold text-gray-500 flex-shrink-0 flex items-center gap-1">
                            {ev.allDay ? "All day" : <><Clock className="w-3 h-3" />{timeLabel(ev.start)}</>}
                          </div>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: sw.bg, color: sw.text }}>
                            {ev.kind === "followup" ? (LEAD_LABEL[ev.leadType || ""] || "Lead") : "You"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Day peek popover (from "+N more") */}
      {dayPeek && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={() => setDayPeek(null)}>
          <div className="dgs-card w-full max-w-md max-h-[80vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[16px] font-extrabold text-ink">{dayPeek.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h3>
              <button onClick={() => setDayPeek(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="space-y-1.5">
              {(byDay.get(dayKey(dayPeek)) || []).map((ev) => {
                const sw = swatchFor(ev);
                return (
                  <button key={ev.id} onClick={() => { setDayPeek(null); onEventClick(ev); }} className="w-full flex items-center gap-2.5 p-2.5 rounded-[12px] hover:bg-gray-50 text-left" style={{ background: sw.bg }}>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: sw.dot }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold truncate" style={{ color: sw.text }}>{ev.title}</div>
                      <div className="text-[11px] opacity-80 truncate" style={{ color: sw.text }}>{ev.kind === "followup" ? (ev.subtitle || "Follow-up") : (ev.location || "Manual entry")}</div>
                    </div>
                    <span className="text-[11px] font-bold flex-shrink-0" style={{ color: sw.text }}>{ev.allDay ? "All day" : timeLabel(ev.start)}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => { const d = dayPeek; setDayPeek(null); openCreate(d); }} className="mt-3 w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-[12px] text-[13px] font-bold text-white" style={heroPrimaryStyle}><Plus className="w-4 h-4" />Add entry this day</button>
          </div>
        </div>
      )}

      {/* Add / edit modal */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={() => !saving && setDraft(null)}>
          <div className="dgs-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-extrabold text-ink">{draft.id ? "Edit entry" : "New calendar entry"}</h3>
              <button onClick={() => setDraft(null)} disabled={saving} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-gray-600 mb-1">Title</label>
                <input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Call back Sunrise HOA" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
              </div>

              <label className="flex items-center gap-2 text-[13px] font-semibold text-gray-700 cursor-pointer">
                <input type="checkbox" checked={draft.allDay} onChange={(e) => {
                  const allDay = e.target.checked;
                  // Convert the start value between date and datetime formats.
                  const base = draft.startAt ? new Date(draft.startAt.length <= 10 ? `${draft.startAt}T09:00` : draft.startAt) : new Date();
                  setDraft({ ...draft, allDay, startAt: allDay ? toLocalDateInput(base) : toLocalInput(base), endAt: "" });
                }} className="w-4 h-4 rounded accent-violet-600" />
                All day
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-600 mb-1">Starts</label>
                  <input type={draft.allDay ? "date" : "datetime-local"} value={draft.startAt} onChange={(e) => setDraft({ ...draft, startAt: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-gray-600 mb-1">Ends <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input type={draft.allDay ? "date" : "datetime-local"} value={draft.endAt} onChange={(e) => setDraft({ ...draft, endAt: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-gray-600 mb-1">Location <span className="text-gray-400 font-normal">(optional)</span></label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="Address or place" className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-gray-600 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-y" />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PALETTE_KEYS.map((k) => (
                    <button key={k} onClick={() => setDraft({ ...draft, color: k })} className={`w-7 h-7 rounded-full transition-transform ${draft.color === k ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105"}`} style={{ background: PALETTE[k].dot }} aria-label={k} />
                  ))}
                </div>
              </div>

              {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[13px]">{error}</div>}
            </div>

            <div className="flex items-center gap-2 mt-5">
              <button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-[12px] text-[14px] font-bold text-white disabled:opacity-50" style={heroPrimaryStyle}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : draft.id ? "Save changes" : "Add to calendar"}
              </button>
              {draft.id && (
                <button onClick={del} disabled={saving} className="flex items-center gap-1.5 px-4 py-2.5 rounded-[12px] text-[13px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors"><Trash2 className="w-4 h-4" />Delete</button>
              )}
              <button onClick={() => setDraft(null)} disabled={saving} className="px-4 py-2.5 rounded-[12px] text-[13px] font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
