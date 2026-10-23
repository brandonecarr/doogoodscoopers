"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw, EyeOff } from "lucide-react";
import {
  CATALOG, GRID, SIZE_PRESETS, catalogItem, defaultConfig, fitsItem, maxKanbanColumns, newSection, packGrid, sizeCells, sizeLabel, sizeOf,
  type CatalogItem, type SectionSize, type SizeCells, type TvBoard, type TvBoardConfig, type TvSection,
} from "@/lib/tv-config";

const input = "w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent";
const label = "block text-sm font-medium text-gray-700 mb-1";
const GROUPS = ["Goals", "Sweep&Go", "Admin", "Other"] as const;
interface KanbanSummary { id: string; name: string; columns: { id: string; name: string; isDone: boolean }[] }
const SOURCE_TINT: Record<string, string> = { goal: "bg-blue-50 border-blue-200", crm: "bg-white border-gray-200", pm: "bg-white border-gray-200" };
const TOTAL_CELLS = GRID.cols * GRID.rows;
const PRESET_NAME: Record<string, string> = { S: "S", M: "M", L: "L", XL: "XL", FULL: "Full" };
/** "any size" or "2×1 or bigger" — the smallest footprint a catalog item can be shown in. */
const minLabel = (c: CatalogItem) => (c.minSize.cols === 1 && c.minSize.rows === 1 ? "any size" : `${c.minSize.cols}×${c.minSize.rows} or bigger`);

/** Boards, sections and a live 4×3 preview laid out exactly like the TV. */
export function BoardsTab({ config, onChange, onOpenKanban }: { config: TvBoardConfig; onChange: (c: TvBoardConfig) => void; onOpenKanban: () => void }) {
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
  const shownCount = config.boards.filter((b) => !b.hidden).length;
  /** Takes the board off the TV (or puts it back) without deleting it. The last shown board can't be turned off. */
  function toggleBoard() {
    if (!board.hidden && shownCount <= 1) return;
    setBoard({ ...board, hidden: !board.hidden });
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
  const usedCells = board.sections.reduce((n, s) => n + sizeCells(s.size).cols * sizeCells(s.size).rows, 0);
  const current = board.sections.find((s) => s.id === selected) ?? null;
  const currentItem = catalogItem(current?.elements[0]?.config.metric);

  return (
    <div className="space-y-3.5">
      {/* Board picker */}
      <div className="flex flex-wrap items-center gap-2">
        {config.boards.map((b, i) => (
          <button key={b.id} onClick={() => { setBoardIndex(i); setSelected(null); setAdding(false); }}
            title={b.hidden ? "Off · not shown on the TV" : undefined}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border ${i === bi ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"} ${b.hidden && i !== bi ? "opacity-50" : ""}`}>
            {b.hidden && <EyeOff className="w-3.5 h-3.5" />}{i + 1}. {b.title || "Untitled"}
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
            <label className="inline-flex items-center gap-2 h-[42px] px-1 select-none"
              title={board.hidden ? "Turn on · show this board on the TV" : shownCount <= 1 ? "The TV needs at least one board on" : "Turn off · keep this board but don't show it on the TV"}>
              <span className={`text-sm font-semibold ${board.hidden ? "text-gray-400" : "text-teal-700"}`}>{board.hidden ? "Off" : "On"}</span>
              <button type="button" role="switch" aria-checked={!board.hidden} onClick={toggleBoard} disabled={!board.hidden && shownCount <= 1}
                className="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-50"
                style={{ background: board.hidden ? "#D1D5DB" : "#0D9488" }}>
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${board.hidden ? "translate-x-0.5" : "translate-x-[22px]"}`} />
              </button>
            </label>
            <button onClick={removeBoard} disabled={config.boards.length <= 1} title="Remove board" className="p-2.5 rounded-lg border border-red-200 bg-white text-red-600 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
          </div>
          {board.hidden && (
            <p className="text-xs text-gray-500 -mt-2">This board is off: it&apos;s kept here with all its sections but the TV skips it. Turn it on to put it back in the rotation.</p>
          )}

          {/* TV preview: same 4×3 grid and packing as the TV (1792×872 design area). */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>TV layout · tap a section to edit</span>
              <span className={usedCells > TOTAL_CELLS ? "text-red-600 font-semibold" : ""}>{usedCells} of {TOTAL_CELLS} cells</span>
            </div>
            <div className="rounded-xl bg-[#F4F6F8] p-2.5 border border-gray-200">
              <div className="grid grid-cols-4 grid-rows-3 gap-1.5" style={{ aspectRatio: "1792 / 872" }}>
                {board.sections.map((s, i) => {
                  const p = placements[i];
                  if (!p) return null;
                  const cells = sizeCells(s.size);
                  const item = catalogItem(s.elements[0]?.config.metric);
                  return (
                    <button key={s.id} onClick={() => { setSelected(s.id); setAdding(false); }}
                      style={{ gridColumn: `${p.col + 1} / span ${cells.cols}`, gridRow: `${p.row + 1} / span ${cells.rows}` }}
                      className={`rounded-lg border text-left p-2 overflow-hidden transition-shadow ${SOURCE_TINT[s.source] || "bg-white border-gray-200"} ${selected === s.id ? "ring-2 ring-teal-500 shadow-md" : "hover:shadow"}`}>
                      <p className="text-[11px] sm:text-xs font-bold text-navy-900 truncate">{s.title}</p>
                      <p className="text-[10px] text-gray-500 truncate">{item?.label ?? "Unknown"} · {sizeLabel(s.size)}</p>
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
                        <p className="text-sm font-semibold text-navy-900">{c.label} <span className="text-[10px] font-medium text-gray-400">{minLabel(c)}</span></p>
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
                  setSection(current.id, { elements: fresh.elements, source: item.source, size: fitsItem(item, current.size) ? current.size : sizeOf(item.minSize.cols, item.minSize.rows), title: current.title === currentItem.defaultTitle ? item.defaultTitle : current.title });
                }} className={input}>
                  {GROUPS.map((g) => <optgroup key={g} label={g}>{CATALOG.filter((c) => c.group === g).map((c) => <option key={c.metric} value={c.metric}>{c.label}</option>)}</optgroup>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">{currentItem.hint}</p>
              </div>
              <div>
                <label className={label}>Size</label>
                <SizePicker value={current.size} min={currentItem.minSize} onChange={(size) => setSection(current.id, { size })} />
                {sizeCells(current.size).cols * sizeCells(current.size).rows === TOTAL_CELLS && board.sections.length > 1 && (
                  <p className="text-xs text-amber-700 mt-1.5">Full screen takes the whole board. Move the other sections to another board (or remove them) before saving.</p>
                )}
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
              {currentItem.fields && <SectionFields key={current.id} fields={currentItem.fields} hireOnCustomers={current.elements[0].config.display === "customers"}
                config={current.elements[0].config}
                onChange={(patch) => setSection(current.id, { elements: [{ ...current.elements[0], config: { ...current.elements[0].config, ...patch } }] })} />}
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
                        <p className="text-sm text-gray-500">No boards yet. <button type="button" onClick={onOpenKanban} className="text-teal-700 font-semibold">Create one in the Kanban tab</button>.</p>
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
                            const max = maxKanbanColumns(current.size);
                            const on = chosen.length ? chosen.includes(col.id) : i < max;
                            const full = !on && (chosen.length || Math.min(kb.columns.length, max)) >= max;
                            return (
                              <label key={col.id} className={`flex items-center gap-2 text-sm ${full ? "text-gray-300" : "text-gray-700"}`}>
                                <input type="checkbox" checked={on} disabled={full} className="rounded border-gray-300 text-teal-600"
                                  onChange={() => {
                                    const base = chosen.length ? chosen : kb.columns.slice(0, max).map((c) => c.id);
                                    const next = on ? base.filter((id) => id !== col.id) : [...base, col.id];
                                    // Keep board order; an empty choice means "the first columns".
                                    setCfg({ columnIDs: kb.columns.map((c) => c.id).filter((id) => next.includes(id)) });
                                  }} />
                                {col.name}{col.isDone && <span className="text-[10px] text-blue-700 font-semibold">DONE</span>}
                              </label>
                            );
                          })}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Up to {maxKanbanColumns(current.size)} columns fit at this size{maxKanbanColumns(current.size) < 8 ? " (8 when it's 4 wide and at least 2 tall)" : ""}.</p>
                      </div>
                    )}
                  </>
                );
              })()}
              {config.boards.length > 1 && (
                <div>
                  <label className={label}>Move to board</label>
                  <select value="" onChange={(e) => {
                    const to = Number(e.target.value);
                    if (Number.isNaN(to)) return;
                    setBoards(config.boards.map((b, i) =>
                      i === bi ? { ...b, sections: b.sections.filter((s) => s.id !== current.id) }
                        : i === to ? { ...b, sections: [...b.sections, current] }
                          : b));
                    setBoardIndex(to);
                  }} className={input}>
                    <option value="">Choose a board…</option>
                    {config.boards.map((b, i) => i !== bi && <option key={b.id} value={i}>{b.title || "Untitled"}</option>)}
                  </select>
                </div>
              )}
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

type ElementConfigPatch = Partial<TvSection["elements"][number]["config"]>;

/** Extra settings some sections need: a target, a person, a place or a message. */
function SectionFields({ fields, config, onChange, hireOnCustomers }: {
  fields: NonNullable<ReturnType<typeof catalogItem>>["fields"];
  config: TvSection["elements"][number]["config"];
  onChange: (patch: ElementConfigPatch) => void;
  hireOnCustomers: boolean;
}) {
  const [zip, setZip] = useState("");
  const [zipError, setZipError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  async function lookUp() {
    setLooking(true); setZipError(null);
    try {
      const r = await fetch(`/api/admin/tv-config/zip?zip=${encodeURIComponent(zip)}`);
      const d = await r.json();
      if (!r.ok) { setZipError(d.error || "Couldn't find that ZIP"); return; }
      onChange({ latitude: d.latitude, longitude: d.longitude, place: d.place });
      setZip("");
    } finally { setLooking(false); }
  }

  return (
    <>
      {fields?.includes("target") && (
        <div>
          <label className={label}>{hireOnCustomers ? "Hire when active customers reach" : "Hire when monthly recurring revenue reaches ($)"}</label>
          <input type="number" min={1} value={config.target ?? ""} placeholder={hireOnCustomers ? "e.g. 120" : "e.g. 12000"}
            onChange={(e) => onChange({ target: e.target.value ? Math.max(0, Number(e.target.value)) : undefined })} className={input} />
        </div>
      )}
      {fields?.includes("person") && (
        <div>
          <label className={label}>Highlight whose share</label>
          <input value={config.person ?? ""} placeholder="e.g. Brandon" onChange={(e) => onChange({ person: e.target.value || undefined })} className={input} />
          <p className="text-xs text-gray-400 mt-1">First name, as it appears in Sweep&amp;Go. Leave blank to highlight nobody.</p>
        </div>
      )}
      {fields?.includes("place") && (
        <div>
          <label className={label}>Location</label>
          {config.place && <p className="text-sm text-navy-900 mb-1.5">{config.place}</p>}
          <div className="flex gap-2">
            <input value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void lookUp(); } }}
              placeholder={config.place ? "Change ZIP" : "ZIP code, e.g. 92392"} className={input} inputMode="numeric" />
            <button type="button" onClick={lookUp} disabled={zip.length !== 5 || looking} className="px-3 rounded-lg border border-gray-200 bg-white text-sm font-medium disabled:opacity-40">{looking ? "…" : "Look up"}</button>
          </div>
          {zipError && <p className="text-xs text-red-600 mt-1">{zipError}</p>}
        </div>
      )}
      {fields?.includes("text") && (
        <div>
          <label className={label}>Message</label>
          <textarea rows={3} maxLength={200} value={config.text ?? ""} placeholder="e.g. Welcome to the team, Sam!" onChange={(e) => onChange({ text: e.target.value })} className={input} />
          <p className="text-xs text-gray-400 mt-1">Up to 200 characters. Shown large, so shorter reads better.</p>
        </div>
      )}
    </>
  );
}

/**
 * Pick any width × height on the TV grid: hover the cells like a table picker, click to set.
 * Cells smaller than what the section needs are greyed out. Presets below for one-tap sizes.
 */
function SizePicker({ value, min, onChange }: { value: SectionSize; min: SizeCells; onChange: (size: SectionSize) => void }) {
  const [hover, setHover] = useState<SizeCells | null>(null);
  const cur = sizeCells(value);
  const shown = hover ?? cur;
  const allowed = (c: SizeCells) => c.cols >= min.cols && c.rows >= min.rows;
  const rows = Array.from({ length: GRID.rows }, (_, r) => r + 1);
  const cols = Array.from({ length: GRID.cols }, (_, c) => c + 1);
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div className="grid gap-1 p-1.5 rounded-lg bg-[#F4F6F8] border border-gray-200" style={{ gridTemplateColumns: `repeat(${GRID.cols}, 22px)` }}
          onMouseLeave={() => setHover(null)} role="group" aria-label="Section size">
          {rows.map((r) => cols.map((c) => {
            const cell = { cols: c, rows: r };
            const ok = allowed(cell);
            const lit = c <= shown.cols && r <= shown.rows;
            const picked = c <= cur.cols && r <= cur.rows;
            return (
              <button key={`${c}-${r}`} type="button" disabled={!ok} title={ok ? `${c}×${r}` : `Needs at least ${min.cols}×${min.rows}`}
                aria-label={`${c} wide by ${r} tall`} aria-pressed={cur.cols === c && cur.rows === r}
                onMouseEnter={() => ok && setHover(cell)} onFocus={() => ok && setHover(cell)} onBlur={() => setHover(null)}
                onClick={() => ok && onChange(sizeOf(c, r))}
                className={`h-[22px] w-[22px] rounded border transition-colors ${!ok ? "bg-gray-100 border-gray-200 cursor-not-allowed" : lit ? (hover ? "bg-teal-400 border-teal-500" : "bg-teal-600 border-teal-600") : picked ? "bg-teal-200 border-teal-300" : "bg-white border-gray-300 hover:border-teal-400"}`} />
            );
          }))}
        </div>
        <div className="text-sm pt-1">
          <p className="font-semibold text-navy-900">{shown.cols} wide × {shown.rows} tall{PRESET_NAME[sizeOf(shown.cols, shown.rows)] ? ` · ${PRESET_NAME[sizeOf(shown.cols, shown.rows)]}` : ""}</p>
          <p className="text-xs text-gray-500">{shown.cols * shown.rows} of {TOTAL_CELLS} cells{min.cols > 1 || min.rows > 1 ? ` · needs at least ${min.cols}×${min.rows}` : ""}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SIZE_PRESETS.map((preset) => {
          const cells = sizeCells(preset);
          const ok = allowed(cells);
          return (
            <button key={preset} type="button" disabled={!ok} onClick={() => onChange(preset)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${value === preset ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-gray-200 text-gray-700"} disabled:opacity-30`}>
              {PRESET_NAME[preset]} · {cells.cols}×{cells.rows}
            </button>
          );
        })}
      </div>
    </div>
  );
}
