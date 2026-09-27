"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import {
  CATALOG, MAX_TV_KANBAN_COLUMNS, SIZE_CELLS, SIZE_LABEL, catalogItem, defaultConfig, newSection, packGrid,
  type SectionSize, type TvBoard, type TvBoardConfig, type TvSection,
} from "@/lib/tv-config";

const input = "w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent";
const label = "block text-sm font-medium text-gray-700 mb-1";
const GROUPS = ["Goals", "Sweep&Go", "Admin"] as const;
interface KanbanSummary { id: string; name: string; columns: { id: string; name: string; isDone: boolean }[] }
const SOURCE_TINT: Record<string, string> = { goal: "bg-blue-50 border-blue-200", crm: "bg-white border-gray-200", pm: "bg-white border-gray-200" };

/** Boards, sections and a live 4×3 preview laid out exactly like the TV. */
export function BoardsTab({ config, onChange }: { config: TvBoardConfig; onChange: (c: TvBoardConfig) => void }) {
  const [boardIndex, setBoardIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [kanbanBoards, setKanbanBoards] = useState<KanbanSummary[]>([]);
  useEffect(() => { fetch("/api/admin/kanban").then((r) => r.json()).then((d) => setKanbanBoards(d.boards || [])).catch(() => {}); }, []);

  const bi = Math.min(boardIndex, config.boards.length - 1);
  const board = config.boards[bi];
  const pipelineID = config.pipelines[0]?.id;

  const setBoards = (boards: TvBoard[]) => onChange({ ...config, boards });
  const setBoard = (next: TvBoard) => setBoards(config.boards.map((b, i) => (i === bi ? next : b)));
  const setSection = (id: string, patch: Partial<TvSection>) =>
    setBoard({ ...board, sections: board.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  function addBoard() {
    const id = `board-${Math.random().toString(36).slice(2, 7)}`;
    setBoards([...config.boards, { id, title: "New Board", sections: [] }]);
    setBoardIndex(config.boards.length);
    setSelected(null);
    setAdding(true);
  }
  function moveBoard(delta: number) {
    const to = bi + delta;
    if (to < 0 || to >= config.boards.length) return;
    const boards = [...config.boards];
    [boards[bi], boards[to]] = [boards[to], boards[bi]];
    setBoards(boards);
    setBoardIndex(to);
  }
  function removeBoard() {
    if (config.boards.length <= 1) return;
    if (!confirm(`Remove "${board.title}" and its sections?`)) return;
    setBoards(config.boards.filter((_, i) => i !== bi));
    setBoardIndex(Math.max(0, bi - 1));
    setSelected(null);
  }
  function moveSection(id: string, delta: number) {
    const i = board.sections.findIndex((s) => s.id === id);
    const to = i + delta;
    if (i < 0 || to < 0 || to >= board.sections.length) return;
    const sections = [...board.sections];
    [sections[i], sections[to]] = [sections[to], sections[i]];
    setBoard({ ...board, sections });
  }
  function addSection(metric: string) {
    const item = catalogItem(metric);
    if (!item) return;
    const section = newSection(item, pipelineID, kanbanBoards[0]);
    setBoard({ ...board, sections: [...board.sections, section] });
    setSelected(section.id);
    setAdding(false);
  }

  const placements = packGrid(board.sections.map((s) => s.size));
  const usedCells = board.sections.reduce((n, s) => n + SIZE_CELLS[s.size].cols * SIZE_CELLS[s.size].rows, 0);
  const current = board.sections.find((s) => s.id === selected) ?? null;
  const currentItem = catalogItem(current?.elements[0]?.config.metric);

  return (
    <div className="space-y-3.5">
      {/* Board picker */}
      <div className="flex flex-wrap items-center gap-2">
        {config.boards.map((b, i) => (
          <button key={b.id} onClick={() => { setBoardIndex(i); setSelected(null); setAdding(false); }}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold border ${i === bi ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
            {i + 1}. {b.title || "Untitled"}
          </button>
        ))}
        <button onClick={addBoard} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-teal-700 hover:bg-teal-50"><Plus className="w-4 h-4" /> Add board</button>
        <button onClick={() => { if (confirm("Replace all boards, the goal and the pipeline with the original design? You can still Discard before saving.")) { onChange(defaultConfig()); setBoardIndex(0); setSelected(null); } }}
          className="ml-auto inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100"><RotateCcw className="w-3.5 h-3.5" /> Reset to design</button>
      </div>

      <div className="grid xl:grid-cols-[1fr_360px] gap-3.5">
        <div className="dgs-card p-5 space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]"><label className={label}>Board title (shown in the TV header)</label><input value={board.title} onChange={(e) => setBoard({ ...board, title: e.target.value })} className={input} /></div>
            <button onClick={() => moveBoard(-1)} disabled={bi === 0} title="Show earlier" className="p-2.5 rounded-lg border border-gray-200 bg-white disabled:opacity-30"><ArrowLeft className="w-4 h-4" /></button>
            <button onClick={() => moveBoard(1)} disabled={bi === config.boards.length - 1} title="Show later" className="p-2.5 rounded-lg border border-gray-200 bg-white disabled:opacity-30"><ArrowRight className="w-4 h-4" /></button>
            <button onClick={removeBoard} disabled={config.boards.length <= 1} title="Remove board" className="p-2.5 rounded-lg border border-red-200 bg-white text-red-600 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
          </div>

          {/* TV preview: same 4×3 grid and packing as the TV (1792×872 design area). */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>TV layout · tap a section to edit</span>
              <span className={usedCells > 12 ? "text-red-600 font-semibold" : ""}>{usedCells} of 12 cells</span>
            </div>
            <div className="rounded-xl bg-[#F4F6F8] p-2.5 border border-gray-200">
              <div className="grid grid-cols-4 grid-rows-3 gap-1.5" style={{ aspectRatio: "1792 / 872" }}>
                {board.sections.map((s, i) => {
                  const p = placements[i];
                  if (!p) return null;
                  const cells = SIZE_CELLS[s.size];
                  const item = catalogItem(s.elements[0]?.config.metric);
                  return (
                    <button key={s.id} onClick={() => { setSelected(s.id); setAdding(false); }}
                      style={{ gridColumn: `${p.col + 1} / span ${cells.cols}`, gridRow: `${p.row + 1} / span ${cells.rows}` }}
                      className={`rounded-lg border text-left p-2 overflow-hidden transition-shadow ${SOURCE_TINT[s.source] || "bg-white border-gray-200"} ${selected === s.id ? "ring-2 ring-teal-500 shadow-md" : "hover:shadow"}`}>
                      <p className="text-[11px] sm:text-xs font-bold text-navy-900 truncate">{s.title}</p>
                      <p className="text-[10px] text-gray-500 truncate">{item?.label ?? "Unknown"} · {s.size}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            {placements.some((p) => p === null) && (
              <p className="text-xs text-red-600 mt-1.5">
                Doesn&apos;t fit: {board.sections.filter((_, i) => !placements[i]).map((s) => s.title).join(", ")}. Make something smaller, move it, or remove a section.
              </p>
            )}
          </div>

          <button onClick={() => { setAdding(true); setSelected(null); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-teal-400 text-sm font-semibold text-teal-700 hover:bg-teal-50">
            <Plus className="w-4 h-4" /> Add section
          </button>
        </div>

        {/* Side panel: section editor or picker */}
        <div className="dgs-card p-5 h-fit space-y-4">
          {adding ? (
            <>
              <div className="flex items-center justify-between"><h3 className="font-semibold text-navy-900">Add a section</h3><button onClick={() => setAdding(false)} className="text-xs text-gray-500">Cancel</button></div>
              {GROUPS.map((g) => (
                <div key={g}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{g}</p>
                  <div className="space-y-1.5">
                    {CATALOG.filter((c) => c.group === g).map((c) => (
                      <button key={c.metric} onClick={() => addSection(c.metric)} className="w-full text-left p-2.5 rounded-lg border border-gray-200 hover:border-teal-400 hover:bg-teal-50/40">
                        <p className="text-sm font-semibold text-navy-900">{c.label} <span className="text-[10px] font-medium text-gray-400">{c.sizes.join(" · ")}</span></p>
                        <p className="text-xs text-gray-500">{c.hint}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : current && currentItem ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-navy-900">Section</h3>
                <div className="flex gap-1">
                  <button onClick={() => moveSection(current.id, -1)} title="Earlier" className="p-1.5 rounded border border-gray-200"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => moveSection(current.id, 1)} title="Later" className="p-1.5 rounded border border-gray-200"><ArrowDown className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div><label className={label}>Title</label><input value={current.title} onChange={(e) => setSection(current.id, { title: e.target.value })} className={input} /></div>
              <div>
                <label className={label}>Shows</label>
                <select value={currentItem.metric} onChange={(e) => {
                  const item = catalogItem(e.target.value)!;
                  const fresh = newSection(item, pipelineID, kanbanBoards[0]);
                  setSection(current.id, { elements: fresh.elements, source: item.source, size: item.sizes.includes(current.size) ? current.size : item.sizes[0], title: current.title === currentItem.defaultTitle ? item.defaultTitle : current.title });
                }} className={input}>
                  {GROUPS.map((g) => <optgroup key={g} label={g}>{CATALOG.filter((c) => c.group === g).map((c) => <option key={c.metric} value={c.metric}>{c.label}</option>)}</optgroup>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">{currentItem.hint}</p>
              </div>
              <div>
                <label className={label}>Size</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["S", "M", "L", "XL"] as SectionSize[]).map((size) => {
                    const ok = currentItem.sizes.includes(size);
                    return (
                      <button key={size} disabled={!ok} onClick={() => setSection(current.id, { size })}
                        className={`py-2 rounded-lg text-xs font-semibold border ${current.size === size ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-gray-200 text-gray-700"} disabled:opacity-30`}>
                        {SIZE_LABEL[size]}
                      </button>
                    );
                  })}
                </div>
              </div>
              {currentItem.displays && currentItem.displays.length > 1 && (
                <div>
                  <label className={label}>Style</label>
                  <select value={current.elements[0].config.display} onChange={(e) => setSection(current.id, { elements: [{ ...current.elements[0], config: { ...current.elements[0].config, display: e.target.value } }] })} className={input}>
                    {currentItem.displays.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
              )}
              {currentItem.usesPipeline && config.pipelines.length > 1 && (
                <div>
                  <label className={label}>Pipeline</label>
                  <select value={current.elements[0].config.pipelineID} onChange={(e) => setSection(current.id, { elements: [{ ...current.elements[0], config: { ...current.elements[0].config, pipelineID: e.target.value } }] })} className={input}>
                    {config.pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              {currentItem.usesKanbanBoard && (() => {
                const cfg = current.elements[0].config;
                const kb = kanbanBoards.find((b) => b.id === cfg.boardID);
                const setCfg = (patch: Partial<typeof cfg>) => setSection(current.id, { elements: [{ ...current.elements[0], config: { ...cfg, ...patch } }] });
                const chosen = cfg.columnIDs ?? [];
                return (
                  <>
                    <div>
                      <label className={label}>Kanban board</label>
                      {kanbanBoards.length === 0 ? (
                        <p className="text-sm text-gray-500">No boards yet. <Link href="/admin/kanban" className="text-teal-700 font-semibold">Create one on the Kanban page</Link>.</p>
                      ) : (
                        <select value={cfg.boardID ?? ""} onChange={(e) => {
                          const next = kanbanBoards.find((b) => b.id === e.target.value);
                          setSection(current.id, { title: kb && current.title === kb.name && next ? next.name : current.title, elements: [{ ...current.elements[0], config: { ...cfg, boardID: e.target.value, columnIDs: undefined } }] });
                        }} className={input}>
                          {!kb && <option value="">Choose a board…</option>}
                          {kanbanBoards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      )}
                    </div>
                    {kb && (
                      <div>
                        <label className={label}>Columns on the TV</label>
                        <div className="space-y-1">
                          {kb.columns.map((col, i) => {
                            const on = chosen.length ? chosen.includes(col.id) : i < MAX_TV_KANBAN_COLUMNS;
                            const full = !on && (chosen.length || Math.min(kb.columns.length, MAX_TV_KANBAN_COLUMNS)) >= MAX_TV_KANBAN_COLUMNS;
                            return (
                              <label key={col.id} className={`flex items-center gap-2 text-sm ${full ? "text-gray-300" : "text-gray-700"}`}>
                                <input type="checkbox" checked={on} disabled={full} className="rounded border-gray-300 text-teal-600"
                                  onChange={() => {
                                    const base = chosen.length ? chosen : kb.columns.slice(0, MAX_TV_KANBAN_COLUMNS).map((c) => c.id);
                                    const next = on ? base.filter((id) => id !== col.id) : [...base, col.id];
                                    // Keep board order; an empty choice means "the first columns".
                                    setCfg({ columnIDs: kb.columns.map((c) => c.id).filter((id) => next.includes(id)) });
                                  }} />
                                {col.name}{col.isDone && <span className="text-[10px] text-blue-700 font-semibold">DONE</span>}
                              </label>
                            );
                          })}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Up to {MAX_TV_KANBAN_COLUMNS} columns fit on the TV.</p>
                      </div>
                    )}
                  </>
                );
              })()}
              <button onClick={() => { setBoard({ ...board, sections: board.sections.filter((s) => s.id !== current.id) }); setSelected(null); }}
                className="inline-flex items-center gap-1.5 text-sm text-red-600 font-medium"><Trash2 className="w-4 h-4" /> Remove section</button>
            </>
          ) : (
            <p className="text-sm text-gray-500">Tap a section in the preview to change its size, title or what it shows, or add a new one.</p>
          )}
        </div>
      </div>
    </div>
  );
}
