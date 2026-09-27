"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus, Trash2, Loader2, Pencil, ArrowLeft, ArrowRight, CheckCircle2, Calendar, User, Tag, X, Check, Tv,
} from "lucide-react";
import { formatDate, toDateInputValue } from "@/lib/datetime";

interface Column { id: string; name: string; color: string | null; isDone: boolean; sortOrder: number }
interface Card { id: string; columnId: string; title: string; notes: string | null; tag: string | null; owner: string | null; dueOn: string | null; sortOrder: number }
interface Board { id: string; name: string; columns: Column[]; cards: Card[] }
interface BoardSummary { id: string; name: string; cardCount: number }

const COLORS: Record<string, { dot: string; header: string; text: string }> = {
  gray: { dot: "bg-gray-400", header: "bg-gray-100", text: "text-gray-800" },
  blue: { dot: "bg-blue-500", header: "bg-blue-50", text: "text-blue-900" },
  green: { dot: "bg-green-500", header: "bg-green-50", text: "text-green-900" },
  amber: { dot: "bg-amber-500", header: "bg-amber-50", text: "text-amber-900" },
  red: { dot: "bg-red-500", header: "bg-red-50", text: "text-red-900" },
  violet: { dot: "bg-violet-500", header: "bg-violet-50", text: "text-violet-900" },
  teal: { dot: "bg-teal-500", header: "bg-teal-50", text: "text-teal-900" },
};
const colorOf = (c: Column) => COLORS[c.color || (c.isDone ? "blue" : "gray")] ?? COLORS.gray;
const input = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent";

async function api(url: string, method = "GET", body?: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Something went wrong");
  return d;
}

/** Custom Kanban boards: any number of boards, columns and cards. */
export function KanbanManager() {
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newBoardName, setNewBoardName] = useState<string | null>(null);
  const [renamingBoard, setRenamingBoard] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [newColumn, setNewColumn] = useState("");
  const [quickAdd, setQuickAdd] = useState<Record<string, string>>({});
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ columnId: string; beforeId: string | null } | null>(null);

  const run = async (work: () => Promise<unknown>) => {
    setError(null);
    try { await work(); } catch (e) { setError((e as Error).message); }
  };

  const loadBoards = (select?: string) =>
    api("/api/admin/kanban").then((d) => {
      setBoards(d.boards);
      const next = select ?? boardId ?? d.boards[0]?.id ?? null;
      setBoardId(d.boards.some((b: BoardSummary) => b.id === next) ? next : d.boards[0]?.id ?? null);
    });
  const loadBoard = (id = boardId): Promise<void> =>
    id ? api(`/api/admin/kanban/${id}`).then((d) => setBoard(d.board)) : Promise.resolve();

  useEffect(() => { loadBoards().catch((e) => setError(e.message)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadBoard().catch((e) => setError(e.message)); }, [boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!boards) return <p className="text-sm text-gray-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>;

  const shown = board && board.id === boardId ? board : null;
  const cardsIn = (columnId: string) => (board?.cards ?? []).filter((c) => c.columnId === columnId).sort((a, b) => a.sortOrder - b.sortOrder);
  const base = board ? `/api/admin/kanban/${board.id}` : "";

  /** Saves the full arrangement (column order + each column's card order). */
  async function saveOrder(columns: Column[], cards: Card[]) {
    if (!board) return;
    setBoard({ ...board, columns, cards }); // optimistic
    await run(async () => {
      const d = await api(base, "PUT", { columns: columns.map((c) => ({ id: c.id, cardIds: cards.filter((k) => k.columnId === c.id).sort((a, b) => a.sortOrder - b.sortOrder).map((k) => k.id) })) });
      setBoard(d.board);
    });
  }

  function dropCard(cardId: string, columnId: string, beforeId: string | null) {
    if (!board || cardId === beforeId) return;
    const moving = board.cards.find((c) => c.id === cardId);
    if (!moving) return;
    const target = cardsIn(columnId).filter((c) => c.id !== cardId);
    const at = beforeId ? Math.max(0, target.findIndex((c) => c.id === beforeId)) : target.length;
    target.splice(at, 0, { ...moving, columnId });
    const reordered = new Map(target.map((c, i) => [c.id, { ...c, sortOrder: i }]));
    const cards = board.cards.map((c) => reordered.get(c.id) ?? c);
    void saveOrder(board.columns, cards);
  }

  function moveColumn(id: string, delta: number) {
    if (!board) return;
    const cols = [...board.columns].sort((a, b) => a.sortOrder - b.sortOrder);
    const i = cols.findIndex((c) => c.id === id);
    const to = i + delta;
    if (to < 0 || to >= cols.length) return;
    [cols[i], cols[to]] = [cols[to], cols[i]];
    void saveOrder(cols.map((c, n) => ({ ...c, sortOrder: n })), board.cards);
  }

  const columns = [...(board?.columns ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-3">
      {/* Boards */}
      <div className="flex flex-wrap items-center gap-2">
        {boards.map((b) => renamingBoard === b.id ? (
          <form key={b.id} onSubmit={(e) => { e.preventDefault(); const name = (e.currentTarget.elements.namedItem("name") as HTMLInputElement).value; void run(async () => { await api(`/api/admin/kanban/${b.id}`, "PATCH", { name }); setRenamingBoard(null); await loadBoards(b.id); await loadBoard(b.id); }); }} className="flex gap-1">
            <input name="name" autoFocus defaultValue={b.name} className={`${input} w-44`} onKeyDown={(e) => e.key === "Escape" && setRenamingBoard(null)} />
            <button className="px-2 rounded-lg bg-teal-600 text-white"><Check className="w-4 h-4" /></button>
          </form>
        ) : (
          <button key={b.id} onClick={() => setBoardId(b.id)} onDoubleClick={() => setRenamingBoard(b.id)} title="Double-click to rename"
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold border ${b.id === boardId ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
            {b.name} <span className="opacity-60 font-normal">· {b.cardCount}</span>
          </button>
        ))}
        {newBoardName === null ? (
          <button onClick={() => setNewBoardName("")} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-teal-700 hover:bg-teal-50"><Plus className="w-4 h-4" /> New board</button>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void run(async () => { const d = await api("/api/admin/kanban", "POST", { name: newBoardName }); setNewBoardName(null); await loadBoards(d.board.id); }); }} className="flex gap-1">
            <input autoFocus value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setNewBoardName(null)} placeholder="Board name, e.g. HOA deals" className={`${input} w-56`} />
            <button disabled={!newBoardName.trim()} className="px-3 rounded-lg bg-teal-600 text-white text-sm font-semibold disabled:opacity-40">Create</button>
            <button type="button" onClick={() => setNewBoardName(null)} className="px-2 text-gray-500"><X className="w-4 h-4" /></button>
          </form>
        )}
        {shown && (
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setRenamingBoard(shown.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-100"><Pencil className="w-3.5 h-3.5" /> Rename</button>
            <button onClick={() => { if (confirm(`Delete "${shown.name}" with all its columns and cards? This can't be undone.`)) void run(async () => { await api(base, "DELETE"); setBoardId(null); await loadBoards(""); }); }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /> Delete board</button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {boards.length === 0 && (
        <div className="dgs-card p-8 text-center">
          <p className="text-navy-900 font-semibold">No boards yet</p>
          <p className="text-sm text-gray-500 mt-1">Create one for anything you track in stages: HOA deals, hiring, equipment, projects…</p>
          <button onClick={() => setNewBoardName("")} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg"><Plus className="w-4 h-4" /> New board</button>
        </div>
      )}

      {shown && (
        <div className="overflow-x-auto pb-4 -mx-4 px-4">
          <div className="flex gap-3 items-start">
            {columns.map((col, ci) => {
              const c = colorOf(col);
              const cards = cardsIn(col.id);
              const over = dropTarget?.columnId === col.id;
              return (
                <div key={col.id} className="w-72 flex-shrink-0"
                  onDragOver={(e) => { e.preventDefault(); if (!over || dropTarget?.beforeId !== null) setDropTarget({ columnId: col.id, beforeId: null }); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }}
                  onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || dragging; const before = dropTarget?.beforeId ?? null; setDropTarget(null); setDragging(null); if (id) dropCard(id, col.id, before); }}>
                  {/* Column header */}
                  <div className={`group px-3 py-2.5 rounded-t-xl ${c.header} border-x border-t border-gray-200`}>
                    {editingColumn === col.id ? (
                      <ColumnEditor column={col} onCancel={() => setEditingColumn(null)} onSave={(patch) => run(async () => { await api(`${base}/columns/${col.id}`, "PATCH", patch); setEditingColumn(null); await loadBoard(); })} />
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <button onClick={() => setEditingColumn(col.id)} className="flex items-center gap-2 min-w-0 text-left" title="Edit column">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.dot}`} />
                          <span className={`text-sm font-semibold truncate ${c.text}`}>{col.name}</span>
                          {col.isDone && <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${c.text}`} />}
                        </button>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full bg-white/70 ${c.text}`}>{cards.length}</span>
                          <button onClick={() => moveColumn(col.id, -1)} disabled={ci === 0} title="Move left" className="p-1 rounded opacity-0 group-hover:opacity-100 disabled:hidden"><ArrowLeft className="w-3.5 h-3.5 text-gray-500" /></button>
                          <button onClick={() => moveColumn(col.id, 1)} disabled={ci === columns.length - 1} title="Move right" className="p-1 rounded opacity-0 group-hover:opacity-100 disabled:hidden"><ArrowRight className="w-3.5 h-3.5 text-gray-500" /></button>
                          <button onClick={() => { if (confirm(cards.length ? `Delete "${col.name}" and its ${cards.length} card${cards.length === 1 ? "" : "s"}?` : `Delete "${col.name}"?`)) void run(async () => { await api(`${base}/columns/${col.id}`, "DELETE"); await loadBoard(); await loadBoards(); }); }}
                            title="Delete column" className="p-1 rounded opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" /></button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cards */}
                  <div className={`min-h-[120px] p-2 space-y-2 rounded-b-xl border border-gray-200 transition-colors ${over ? "bg-teal-50/60 ring-2 ring-teal-400" : "bg-gray-50"}`}>
                    {cards.map((card) => {
                      const overdue = !!card.dueOn && !col.isDone && toDateInputValue(card.dueOn) < toDateInputValue(new Date());
                      const insertHere = dropTarget?.columnId === col.id && dropTarget.beforeId === card.id;
                      return (
                        <div key={card.id}>
                          {insertHere && <div className="h-1 rounded bg-teal-500 mb-2" />}
                          <div draggable
                            onDragStart={(e) => { setDragging(card.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", card.id); }}
                            onDragEnd={() => { setDragging(null); setDropTarget(null); }}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (dropTarget?.beforeId !== card.id) setDropTarget({ columnId: col.id, beforeId: card.id }); }}
                            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const id = e.dataTransfer.getData("text/plain") || dragging; setDropTarget(null); setDragging(null); if (id) dropCard(id, col.id, card.id); }}
                            onClick={() => setOpenCard(card)}
                            className={`bg-white rounded-lg border border-gray-200 shadow-sm p-3 cursor-grab active:cursor-grabbing hover:border-teal-300 ${dragging === card.id ? "opacity-40" : ""}`}>
                            <p className={`text-sm font-semibold text-navy-900 ${col.isDone ? "line-through decoration-gray-300" : ""}`}>{card.title}</p>
                            {card.notes && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{card.notes}</p>}
                            {(card.tag || card.owner || card.dueOn) && (
                              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                {card.tag && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-violet-50 text-violet-800"><Tag className="w-3 h-3" />{card.tag}</span>}
                                {card.owner && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-gray-100 text-gray-700"><User className="w-3 h-3" />{card.owner}</span>}
                                {card.dueOn && <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded ${overdue ? "bg-red-100 text-red-800" : "bg-teal-50 text-teal-800"}`}><Calendar className="w-3 h-3" />{formatDate(card.dueOn, { month: "short", day: "numeric" })}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {over && dropTarget?.beforeId === null && <div className="h-1 rounded bg-teal-500" />}

                    {/* Quick add: type and press Enter; the box stays ready for the next one. */}
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const title = (quickAdd[col.id] || "").trim();
                      if (!title) return;
                      setQuickAdd((q) => ({ ...q, [col.id]: "" }));
                      void run(async () => { await api(`${base}/cards`, "POST", { columnId: col.id, title }); await loadBoard(); await loadBoards(); });
                    }}>
                      <input value={quickAdd[col.id] || ""} onChange={(e) => setQuickAdd((q) => ({ ...q, [col.id]: e.target.value }))}
                        placeholder="+ Add a card" className="w-full px-3 py-2 rounded-lg text-sm bg-transparent border border-transparent placeholder:text-gray-400 hover:bg-white focus:bg-white focus:border-teal-400 focus:outline-none" />
                    </form>
                  </div>
                </div>
              );
            })}

            {/* Add column */}
            <form onSubmit={(e) => { e.preventDefault(); if (!newColumn.trim()) return; const name = newColumn; setNewColumn(""); void run(async () => { await api(`${base}/columns`, "POST", { name }); await loadBoard(); }); }}
              className="w-64 flex-shrink-0 rounded-xl border-2 border-dashed border-gray-200 p-2">
              <input value={newColumn} onChange={(e) => setNewColumn(e.target.value)} placeholder="+ Add a column" className="w-full px-3 py-2 rounded-lg text-sm bg-transparent placeholder:text-gray-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </form>
          </div>
        </div>
      )}

      {shown && <p className="text-[11px] text-gray-400 inline-flex items-center gap-1">Drag cards to move or reorder them. Click a column name to rename, recolor, or mark it as the &quot;done&quot; column. <Tv className="w-3 h-3" /> To show a board on the TV: Boards tab → Add section → Kanban board.</p>}

      {openCard && shown && (
        <CardEditor card={openCard} columns={columns} onClose={() => setOpenCard(null)}
          onSave={(patch) => run(async () => { await api(`${base}/cards/${openCard.id}`, "PATCH", patch); setOpenCard(null); await loadBoard(); })}
          onDelete={() => { if (confirm(`Delete "${openCard.title}"?`)) void run(async () => { await api(`${base}/cards/${openCard.id}`, "DELETE"); setOpenCard(null); await loadBoard(); await loadBoards(); }); }} />
      )}
    </div>
  );
}

function ColumnEditor({ column, onSave, onCancel }: { column: Column; onSave: (patch: Partial<Column>) => void; onCancel: () => void }) {
  const [name, setName] = useState(column.name);
  const [color, setColor] = useState(column.color || (column.isDone ? "blue" : "gray"));
  const [isDone, setIsDone] = useState(column.isDone);
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave({ name, color, isDone }); }} className="space-y-2">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Escape" && onCancel()} className={input} />
      <div className="flex gap-1.5">
        {Object.entries(COLORS).map(([key, c]) => (
          <button type="button" key={key} onClick={() => setColor(key)} title={key}
            className={`w-5 h-5 rounded-full ${c.dot} ${color === key ? "ring-2 ring-offset-1 ring-navy-900" : ""}`} />
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input type="checkbox" checked={isDone} onChange={(e) => setIsDone(e.target.checked)} className="rounded border-gray-300 text-teal-600" />
        &quot;Done&quot; column (highlighted on the TV; its cards aren&apos;t overdue)
      </label>
      <div className="flex justify-end gap-1.5">
        <button type="button" onClick={onCancel} className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg bg-white">Cancel</button>
        <button className="px-2.5 py-1 text-xs bg-teal-600 text-white rounded-lg">Save</button>
      </div>
    </form>
  );
}

function CardEditor({ card, columns, onSave, onDelete, onClose }: {
  card: Card; columns: Column[]; onSave: (patch: Record<string, unknown>) => void; onDelete: () => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState({ title: card.title, notes: card.notes || "", tag: card.tag || "", owner: card.owner || "", dueOn: toDateInputValue(card.dueOn), columnId: card.columnId });
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, []);
  const label = "block text-xs font-medium text-gray-600 mb-1";
  const save = () => {
    const patch: Record<string, unknown> = { title: draft.title, notes: draft.notes, tag: draft.tag, owner: draft.owner, dueOn: draft.dueOn || null };
    if (draft.columnId !== card.columnId) patch.columnId = draft.columnId;
    onSave(patch);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (draft.title.trim()) save(); }}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-3 shadow-xl">
        <div className="flex items-center justify-between"><h3 className="font-semibold text-navy-900">Card</h3><button type="button" onClick={onClose} className="p-1 text-gray-400"><X className="w-5 h-5" /></button></div>
        <div><label className={label}>Title</label><input ref={titleRef} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={input} /></div>
        <div><label className={label}>Notes</label><textarea rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className={input} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={label}>Tag</label><input value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })} placeholder="e.g. HOA" className={input} /></div>
          <div><label className={label}>Owner</label><input value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} placeholder="e.g. Valerie" className={input} /></div>
          <div><label className={label}>Due</label><input type="date" value={draft.dueOn} onChange={(e) => setDraft({ ...draft, dueOn: e.target.value })} className={input} /></div>
          <div><label className={label}>Column</label>
            <select value={draft.columnId} onChange={(e) => setDraft({ ...draft, columnId: e.target.value })} className={input}>
              {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 text-sm text-red-600"><Trash2 className="w-4 h-4" /> Delete</button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancel</button>
            <button disabled={!draft.title.trim()} className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg font-semibold disabled:opacity-40">Save</button>
          </div>
        </div>
      </form>
    </div>
  );
}
