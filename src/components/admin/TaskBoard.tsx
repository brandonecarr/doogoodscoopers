"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Calendar, User, Tag, ArrowRight, ArrowLeft, Pencil, X, Check } from "lucide-react";
import { toDateInputValue, formatDate } from "@/lib/datetime";

type Status = "TODO" | "DOING" | "DONE";
interface Task { id: string; title: string; notes: string | null; tag: string | null; owner: string | null; dueOn: string | null; doneAt: string | null; status: Status; sortOrder: number }
type Draft = { title: string; tag: string; owner: string; dueOn: string; notes: string };

const COLUMNS: { status: Status; name: string; hint: string; header: string; border: string; bg: string; text: string }[] = [
  { status: "TODO", name: "To do", hint: "Not started", header: "bg-gray-100", border: "border-gray-200", bg: "bg-gray-50", text: "text-gray-800" },
  { status: "DOING", name: "In progress", hint: "Someone's on it", header: "bg-amber-50", border: "border-amber-200", bg: "bg-amber-50/40", text: "text-amber-900" },
  { status: "DONE", name: "Done", hint: "Last 30 days · the TV shows this week", header: "bg-blue-50", border: "border-blue-200", bg: "bg-blue-50/40", text: "text-blue-900" },
];
const TAG_SUGGESTIONS = ["Supplies", "Fleet", "Crew", "Customers", "Commercial", "Marketing", "Admin"];
const input = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent";
const empty: Draft = { title: "", tag: "", owner: "", dueOn: "", notes: "" };

/** The team task board. The Apple TV's Operations board shows To do, In progress and Done this week. */
export function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<Status | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch("/api/admin/tasks").then((r) => r.json()).then((d) => setTasks(d.tasks || [])).catch(() => setError("Couldn't load tasks")).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);

  async function send(url: string, method: string, body?: unknown) {
    setError(null);
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Something went wrong");
    return d;
  }

  async function create(status: Status) {
    if (!draft.title.trim()) return;
    setBusy(true);
    try { await send("/api/admin/tasks", "POST", { ...draft, status }); setDraft(empty); setAdding(null); await load(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function save(id: string) {
    if (!draft.title.trim()) return;
    setBusy(true);
    try { await send(`/api/admin/tasks/${id}`, "PATCH", draft); setEditing(null); setDraft(empty); await load(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function move(id: string, status: Status) {
    const task = tasks.find((t) => t.id === id);
    if (!task || task.status === status) return;
    const bottom = Math.max(0, ...tasks.filter((t) => t.status === status).map((t) => t.sortOrder)) + 1;
    setTasks((all) => all.map((t) => (t.id === id ? { ...t, status, sortOrder: bottom } : t))); // optimistic
    try { await send(`/api/admin/tasks/${id}`, "PATCH", { status, sortOrder: bottom }); await load(); }
    catch (e) { setError((e as Error).message); await load(); }
  }

  async function remove(task: Task) {
    if (!confirm(`Delete "${task.title}"?`)) return;
    try { await send(`/api/admin/tasks/${task.id}`, "DELETE"); await load(); }
    catch (e) { setError((e as Error).message); }
  }

  function startEdit(task: Task) {
    setAdding(null);
    setEditing(task.id);
    setDraft({ title: task.title, tag: task.tag || "", owner: task.owner || "", dueOn: toDateInputValue(task.dueOn), notes: task.notes || "" });
  }

  const today = toDateInputValue(new Date());
  const form = (onSubmit: () => void, onCancel: () => void, submitLabel: string) => (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="bg-white rounded-lg border border-teal-300 shadow-sm p-3 space-y-2">
      <input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="What needs doing?" className={input} />
      <div className="grid grid-cols-2 gap-2">
        <input list="task-tags" value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })} placeholder="Tag" className={input} />
        <input value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} placeholder="Owner" className={input} />
      </div>
      <input type="date" value={draft.dueOn} onChange={(e) => setDraft({ ...draft, dueOn: e.target.value })} className={input} aria-label="Due date" />
      <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes (optional)" rows={2} className={input} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"><X className="w-3.5 h-3.5" /> Cancel</button>
        <button type="submit" disabled={busy || !draft.title.trim()} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"><Check className="w-3.5 h-3.5" /> {submitLabel}</button>
      </div>
    </form>
  );

  if (loading) return <p className="text-sm text-gray-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>;

  return (
    <div className="space-y-3">
      <datalist id="task-tags">{TAG_SUGGESTIONS.map((t) => <option key={t} value={t} />)}</datalist>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      <div className="overflow-x-auto pb-4 -mx-4 px-4">
        <div className="grid grid-cols-3 gap-4 items-start" style={{ minWidth: "816px" }}>
          {COLUMNS.map((col, ci) => {
            const items = tasks.filter((t) => t.status === col.status);
            const isOver = over === col.status;
            return (
              <div key={col.status}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== col.status) setOver(col.status); }}
                onDragLeave={() => setOver((o) => (o === col.status ? null : o))}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || dragging; setOver(null); setDragging(null); if (id) void move(id, col.status); }}
              >
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${col.header} border-x border-t ${col.border}`}>
                  <div className="min-w-0"><p className={`text-sm font-semibold ${col.text}`}>{col.name}</p><p className={`text-[10px] ${col.text} opacity-70 truncate`}>{col.hint}</p></div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full bg-white/70 ${col.text}`}>{items.length}</span>
                    <button onClick={() => { setEditing(null); setDraft(empty); setAdding(col.status); }} title="Add task" className="p-1 rounded hover:bg-white/70"><Plus className={`w-4 h-4 ${col.text}`} /></button>
                  </div>
                </div>
                <div className={`min-h-[160px] p-2 space-y-2 rounded-b-xl border ${col.border} ${isOver ? "bg-white ring-2 ring-teal-400" : col.bg} transition-colors`}>
                  {adding === col.status && form(() => create(col.status), () => setAdding(null), "Add")}
                  {items.length === 0 && adding !== col.status && <p className="text-xs text-gray-400 text-center py-6">Drop a task here</p>}
                  {items.map((task) => {
                    if (editing === task.id) return <div key={task.id}>{form(() => save(task.id), () => setEditing(null), "Save")}</div>;
                    const overdue = task.status !== "DONE" && !!task.dueOn && toDateInputValue(task.dueOn) < today;
                    return (
                      <div key={task.id} draggable
                        onDragStart={(e) => { setDragging(task.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", task.id); }}
                        onDragEnd={() => { setDragging(null); setOver(null); }}
                        className={`group bg-white rounded-lg border border-gray-200 shadow-sm p-3 cursor-grab active:cursor-grabbing hover:border-teal-300 transition-all ${dragging === task.id ? "opacity-40" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-semibold text-navy-900 ${task.status === "DONE" ? "line-through decoration-gray-300" : ""}`}>{task.title}</p>
                          <div className="flex gap-0.5 opacity-60 group-hover:opacity-100 flex-shrink-0">
                            <button onClick={() => startEdit(task)} title="Edit" className="p-1 rounded hover:bg-gray-100"><Pencil className="w-3.5 h-3.5 text-gray-500" /></button>
                            <button onClick={() => remove(task)} title="Delete" className="p-1 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" /></button>
                          </div>
                        </div>
                        {task.notes && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.notes}</p>}
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {task.tag && <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded ${task.tag.toLowerCase() === "commercial" ? "bg-teal-50 text-teal-800" : "bg-violet-50 text-violet-800"}`}><Tag className="w-3 h-3" />{task.tag}</span>}
                          {task.owner && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-gray-100 text-gray-700"><User className="w-3 h-3" />{task.owner}</span>}
                          {task.dueOn && task.status !== "DONE" && <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded ${overdue ? "bg-red-100 text-red-800" : "bg-teal-50 text-teal-800"}`}><Calendar className="w-3 h-3" />{overdue ? "Overdue · " : ""}{formatDate(task.dueOn, { month: "short", day: "numeric" })}</span>}
                          {task.status === "DONE" && task.doneAt && <span className="text-[10px] text-gray-400">Done {formatDate(task.doneAt, { month: "short", day: "numeric" })}</span>}
                        </div>
                        {/* Buttons for touch screens, where drag-and-drop isn't available. */}
                        <div className="flex justify-between mt-2 lg:hidden">
                          {ci > 0 ? <button onClick={() => move(task.id, COLUMNS[ci - 1].status)} className="inline-flex items-center gap-1 text-[11px] text-gray-500"><ArrowLeft className="w-3 h-3" />{COLUMNS[ci - 1].name}</button> : <span />}
                          {ci < COLUMNS.length - 1 && <button onClick={() => move(task.id, COLUMNS[ci + 1].status)} className="inline-flex items-center gap-1 text-[11px] text-teal-700 font-semibold">{COLUMNS[ci + 1].name}<ArrowRight className="w-3 h-3" /></button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-gray-400">Drag cards between columns. The office TV shows the first few of each column, with overdue tasks in red.</p>
    </div>
  );
}
