"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { LayoutGrid, Paintbrush, Undo2, Redo2, Monitor, Smartphone, Eye, Pencil, Loader2 } from "lucide-react";
import {
  type Design, type Block, type Section, type Column, type Selection, type BrandLibrary, type BlockType, type GlobalStyles,
  DEFAULT_BRAND, emptyDesign, isDesign, newBlock, newSection, cloneWithIds, findBlock, findColumn, findSection,
} from "@/lib/email-designer/model";
import { renderDesign } from "@/lib/email-designer/render";
import { importHtml } from "@/lib/email-designer/import-html";
import { buildPreset } from "@/lib/email-designer/presets";
import { Canvas, type DropTarget, type Device } from "./Canvas";
import { ContentRail, type RailTab } from "./ContentRail";
import { BlockPanel } from "./panels/BlockPanel";
import { SectionPanel, ColumnPanel } from "./panels/ContainerPanel";
import { StylePanel } from "./panels/StylePanel";

/* The email designer. The parent owns saving: it gets a handle with getHtml() and
   getDesign() and can show a dirty indicator through onChange. */

export interface EmailDesignerHandle {
  getHtml: () => string;
  getDesign: () => Design;
  isDirty: () => boolean;
}

interface Props {
  /** A version-2 design, or anything older (then `initialHtml` is imported). */
  initialDesign?: unknown;
  initialHtml?: string;
  onReady?: (handle: EmailDesignerHandle) => void;
  onChange?: (dirty: boolean) => void;
}

const DT = { newBlock: "dgs/new-block", newSection: "dgs/new-section", moveBlock: "dgs/move-block", moveSection: "dgs/move-section" };

export default function EmailDesigner({ initialDesign, initialHtml, onReady, onChange }: Props) {
  const [brand, setBrand] = useState<BrandLibrary>(DEFAULT_BRAND);
  const [brandLoaded, setBrandLoaded] = useState(false);
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandSaved, setBrandSaved] = useState(false);
  const [design, setDesignState] = useState<Design | null>(null);
  // Undo history lives in refs (mutated in event handlers, never during render); histTick re-renders the buttons.
  const pastRef = useRef<Design[]>([]);
  const futureRef = useRef<Design[]>([]);
  const [histTick, setHistTick] = useState(0);
  const [selection, setSelection] = useState<Selection>(null);
  const [leftTab, setLeftTab] = useState<"content" | "style">("content");
  const [railTab, setRailTab] = useState<RailTab>("blocks");
  const [device, setDevice] = useState<Device>("desktop");
  const [previewing, setPreviewing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dirtyRef = useRef(false);
  const designRef = useRef<Design | null>(null);
  designRef.current = design;

  // Brand library, then the document (imported from HTML when it isn't a v2 design).
  useEffect(() => {
    fetch("/api/admin/email-brand").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.brand) setBrand(d.brand); }).catch(() => {}).finally(() => setBrandLoaded(true));
  }, []);
  useEffect(() => {
    if (!brandLoaded || design) return;
    let doc: Design;
    if (isDesign(initialDesign)) doc = initialDesign;
    else if (initialHtml && initialHtml.trim()) doc = importHtml(initialHtml, brand);
    else doc = emptyDesign(brand);
    setDesignState(doc);
  }, [brandLoaded, design, initialDesign, initialHtml, brand]);

  const setDesign = useCallback((next: Design | ((d: Design) => Design), opts: { history?: boolean } = {}) => {
    const cur = designRef.current;
    if (!cur) return;
    const value = typeof next === "function" ? next(cur) : next;
    if (value === cur) return;
    if (opts.history !== false) { pastRef.current = [...pastRef.current.slice(-60), cur]; futureRef.current = []; setHistTick((t) => t + 1); }
    dirtyRef.current = true;
    designRef.current = value;
    setDesignState(value);
  }, []);
  // Tell the parent about changes after they commit (never during a render).
  useEffect(() => { if (dirtyRef.current) onChange?.(true); }, [design, onChange]);

  const undo = useCallback(() => {
    const prev = pastRef.current.pop();
    const cur = designRef.current;
    if (!prev || !cur) return;
    futureRef.current = [cur, ...futureRef.current].slice(0, 60);
    designRef.current = prev; setDesignState(prev); setHistTick((t) => t + 1);
  }, []);
  const redo = useCallback(() => {
    const next = futureRef.current.shift();
    const cur = designRef.current;
    if (!next || !cur) return;
    pastRef.current = [...pastRef.current, cur];
    designRef.current = next; setDesignState(next); setHistTick((t) => t + 1);
  }, []);
  void histTick;

  // Parent handle.
  useEffect(() => {
    onReady?.({
      getHtml: () => (designRef.current ? renderDesign(designRef.current) : initialHtml || ""),
      getDesign: () => designRef.current ?? emptyDesign(brand),
      isDirty: () => dirtyRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReady]);

  // Keyboard: undo/redo, delete, escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      if (e.key === "Escape") setSelection(null);
      if ((e.key === "Delete" || e.key === "Backspace") && !typing && selection) { e.preventDefault(); remove(selection); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, undo, redo]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const updateBlock = useCallback((id: string, patch: Partial<Block>, history = true) => {
    setDesign((d) => {
      const path = findBlock(d, id);
      if (!path) return d;
      const sections = d.sections.map((s, si) => si !== path.si ? s : { ...s, columns: s.columns.map((c, ci) => ci !== path.ci ? c : { ...c, blocks: c.blocks.map((b, bi) => (bi !== path.bi ? b : ({ ...b, ...patch } as Block))) }) });
      return { ...d, sections };
    }, { history });
  }, [setDesign]);
  const updateSection = (id: string, patch: Partial<Section>) => setDesign((d) => ({ ...d, sections: d.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const updateColumn = (id: string, patch: Partial<Column>) => setDesign((d) => ({ ...d, sections: d.sections.map((s) => ({ ...s, columns: s.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) })) }));

  const insertBlock = (block: Block, target: DropTarget) => setDesign((d) => {
    if (target.kind === "section") {
      const sec = newSection([100]);
      sec.columns[0].blocks = [block];
      return { ...d, sections: [...d.sections.slice(0, target.index), sec, ...d.sections.slice(target.index)] };
    }
    return { ...d, sections: d.sections.map((s) => ({ ...s, columns: s.columns.map((c) => (c.id !== target.columnId ? c : { ...c, blocks: [...c.blocks.slice(0, target.index), block, ...c.blocks.slice(target.index)] })) })) };
  });
  const insertSection = (section: Section, target: DropTarget) => setDesign((d) => {
    let index = target.kind === "section" ? target.index : d.sections.findIndex((s) => s.columns.some((c) => c.id === (target as { columnId: string }).columnId)) + 1;
    if (index < 0) index = d.sections.length;
    return { ...d, sections: [...d.sections.slice(0, index), section, ...d.sections.slice(index)] };
  });
  const removeNode = (d: Design, sel: Selection): Design => {
    if (!sel) return d;
    if (sel.kind === "section") return { ...d, sections: d.sections.filter((s) => s.id !== sel.id) };
    if (sel.kind === "column") return { ...d, sections: d.sections.map((s) => (s.columns.length > 1 ? { ...s, columns: s.columns.filter((c) => c.id !== sel.id) } : s)) };
    return { ...d, sections: d.sections.map((s) => ({ ...s, columns: s.columns.map((c) => ({ ...c, blocks: c.blocks.filter((b) => b.id !== sel.id) })) })) };
  };
  const remove = (sel: Selection) => { setDesign((d) => removeNode(d, sel)); setSelection(null); };
  const duplicate = (sel: Selection) => setDesign((d) => {
    if (!sel) return d;
    if (sel.kind === "section") { const f = findSection(d, sel.id); if (!f) return d; const copy = cloneWithIds(f.section); return { ...d, sections: [...d.sections.slice(0, f.si + 1), copy, ...d.sections.slice(f.si + 1)] }; }
    if (sel.kind === "block") { const f = findBlock(d, sel.id); if (!f) return d; const copy = cloneWithIds(f.block); return { ...d, sections: d.sections.map((s, si) => si !== f.si ? s : { ...s, columns: s.columns.map((c, ci) => ci !== f.ci ? c : { ...c, blocks: [...c.blocks.slice(0, f.bi + 1), copy, ...c.blocks.slice(f.bi + 1)] }) }) }; }
    return d;
  });
  const move = (sel: Selection, dir: -1 | 1) => setDesign((d) => {
    if (!sel) return d;
    const swap = <T,>(arr: T[], i: number) => { const j = i + dir; if (j < 0 || j >= arr.length) return arr; const out = [...arr]; [out[i], out[j]] = [out[j], out[i]]; return out; };
    if (sel.kind === "section") { const f = findSection(d, sel.id); return f ? { ...d, sections: swap(d.sections, f.si) } : d; }
    if (sel.kind === "block") { const f = findBlock(d, sel.id); if (!f) return d; return { ...d, sections: d.sections.map((s, si) => si !== f.si ? s : { ...s, columns: s.columns.map((c, ci) => ci !== f.ci ? c : { ...c, blocks: swap(c.blocks, f.bi) }) }) }; }
    return d;
  });

  // ── Drag and drop ──────────────────────────────────────────────────────────

  const onRailDragStart = (e: DragEvent, payload: { newBlock?: BlockType; newSection?: string }) => {
    if (payload.newBlock) e.dataTransfer.setData(DT.newBlock, payload.newBlock);
    if (payload.newSection) e.dataTransfer.setData(DT.newSection, payload.newSection);
    e.dataTransfer.effectAllowed = "copyMove";
    setDragging(true);
  };
  const onCanvasDragStart = (e: DragEvent, payload: { move: "block" | "section"; id: string }) => {
    e.dataTransfer.setData(payload.move === "block" ? DT.moveBlock : DT.moveSection, payload.id);
    e.dataTransfer.effectAllowed = "move";
    e.stopPropagation();
    setDragging(true);
  };
  const onDrop = (e: DragEvent, target: DropTarget) => {
    setDragging(false);
    const nb = e.dataTransfer.getData(DT.newBlock) as BlockType;
    const ns = e.dataTransfer.getData(DT.newSection);
    const mb = e.dataTransfer.getData(DT.moveBlock);
    const ms = e.dataTransfer.getData(DT.moveSection);
    if (nb) { const b = newBlock(nb, brand); insertBlock(b, target); setSelection({ kind: "block", id: b.id }); return; }
    if (ns) { const s = buildPreset(ns, brand); if (s) { insertSection(s, target); setSelection({ kind: "section", id: s.id }); } return; }
    if (mb) {
      setDesign((d) => {
        const f = findBlock(d, mb); if (!f) return d;
        let t = target;
        // Removing first shifts indexes within the same column.
        if (t.kind === "block" && t.columnId === f.column.id && t.index > f.bi) t = { ...t, index: t.index - 1 };
        const without = removeNode(d, { kind: "block", id: mb });
        if (t.kind === "section") { const sec = newSection([100]); sec.columns[0].blocks = [f.block]; return { ...without, sections: [...without.sections.slice(0, t.index), sec, ...without.sections.slice(t.index)] }; }
        const tt = t;
        return { ...without, sections: without.sections.map((s) => ({ ...s, columns: s.columns.map((c) => (c.id !== tt.columnId ? c : { ...c, blocks: [...c.blocks.slice(0, tt.index), f.block, ...c.blocks.slice(tt.index)] })) })) };
      });
      return;
    }
    if (ms && target.kind === "section") {
      setDesign((d) => {
        const f = findSection(d, ms); if (!f) return d;
        const idx = target.index > f.si ? target.index - 1 : target.index;
        const rest = d.sections.filter((s) => s.id !== ms);
        return { ...d, sections: [...rest.slice(0, idx), f.section, ...rest.slice(idx)] };
      });
    }
  };
  const addAtEnd = (block?: Block, section?: Section) => {
    const d = designRef.current; if (!d) return;
    if (section) { insertSection(section, { kind: "section", index: d.sections.length }); setSelection({ kind: "section", id: section.id }); return; }
    if (!block) return;
    const last = d.sections[d.sections.length - 1];
    if (last) { const col = last.columns[last.columns.length - 1]; insertBlock(block, { kind: "block", columnId: col.id, index: col.blocks.length }); }
    else insertBlock(block, { kind: "section", index: 0 });
    setSelection({ kind: "block", id: block.id });
  };

  // ── Brand library persistence ──────────────────────────────────────────────
  const brandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changeBrand = (b: BrandLibrary) => {
    setBrand(b);
    if (brandTimer.current) clearTimeout(brandTimer.current);
    brandTimer.current = setTimeout(async () => {
      setBrandSaving(true); setBrandSaved(false);
      try {
        const res = await fetch("/api/admin/email-brand", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand: b }) });
        if (res.ok) { const d = await res.json(); if (d.brand) setBrand(d.brand); setBrandSaved(true); setTimeout(() => setBrandSaved(false), 2000); }
      } finally { setBrandSaving(false); }
    }, 700);
  };

  // ── Selection → panel ──────────────────────────────────────────────────────
  const selected = useMemo(() => {
    if (!design || !selection) return null;
    if (selection.kind === "block") return findBlock(design, selection.id)?.block ?? null;
    if (selection.kind === "column") return findColumn(design, selection.id)?.column ?? null;
    return findSection(design, selection.id)?.section ?? null;
  }, [design, selection]);
  useEffect(() => { if (selection && !selected) setSelection(null); }, [selection, selected]);

  if (!design) {
    return <div className="h-full flex items-center justify-center text-gray-400 text-sm"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading designer…</div>;
  }

  const panel = (() => {
    if (leftTab === "style") return <StylePanel styles={design.styles} brand={brand} onChange={(styles: GlobalStyles) => setDesign((d) => ({ ...d, styles }))} onBrandChange={changeBrand} brandSaving={brandSaving} brandSaved={brandSaved} />;
    if (selected && selection?.kind === "block") return <BlockPanel block={selected as Block} styles={design.styles} brand={brand} onChange={(patch) => updateBlock(selected.id, patch)} onClose={() => setSelection(null)} />;
    if (selected && selection?.kind === "section") return <SectionPanel section={selected as Section} brand={brand} onChange={(patch) => updateSection(selected.id, patch)} onClose={() => setSelection(null)} />;
    if (selected && selection?.kind === "column") return <ColumnPanel column={selected as Column} brand={brand} onChange={(patch) => updateColumn(selected.id, patch)} onClose={() => setSelection(null)} />;
    return <ContentRail tab={railTab} setTab={setRailTab} brand={brand} onDragStart={onRailDragStart} onDragEnd={() => setDragging(false)} onAddBlock={(t) => addAtEnd(newBlock(t, brand))} onAddSection={(k) => { const s = buildPreset(k, brand); if (s) addAtEnd(undefined, s); }} />;
  })();

  return (
    <div className="flex h-full min-h-0 bg-white text-navy-900" onDragEnd={() => setDragging(false)}>
      {/* Left rail */}
      <div className="w-[76px] shrink-0 border-r border-gray-100 flex flex-col items-center py-3 gap-1 bg-white">
        {([["content", "Content", <LayoutGrid key="c" className="w-5 h-5" />], ["style", "Style", <Paintbrush key="s" className="w-5 h-5" />]] as const).map(([key, label, icon]) => (
          <button key={key} type="button" onClick={() => { setLeftTab(key); if (key === "style") setSelection(null); }}
            className={`w-14 py-2 rounded-xl flex flex-col items-center gap-1 text-[11px] font-medium ${leftTab === key && (key === "style" || !selected) ? "bg-violet-50 text-violet-700" : "text-gray-500 hover:bg-gray-50"}`}>
            {icon}{label}
          </button>
        ))}
      </div>
      {/* Panel */}
      <div className="w-[400px] shrink-0 border-r border-gray-100 flex flex-col min-h-0 bg-white">{panel}</div>
      {/* Canvas */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="h-11 shrink-0 flex items-center gap-2 px-3 border-b border-gray-100 bg-white">
          <button type="button" onClick={undo} disabled={!pastRef.current.length} title="Undo (⌘Z)" className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"><Undo2 className="w-4 h-4" /></button>
          <button type="button" onClick={redo} disabled={!futureRef.current.length} title="Redo (⇧⌘Z)" className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"><Redo2 className="w-4 h-4" /></button>
          <span className="text-[12px] text-gray-400 ml-1">{selected ? `Editing ${selection?.kind}` : "Click anything in the email to edit it"}</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
              <button type="button" onClick={() => setDevice("desktop")} title="Desktop" className={`p-1.5 ${device === "desktop" ? "bg-gray-100 text-navy-900" : "text-gray-500"}`}><Monitor className="w-4 h-4" /></button>
              <button type="button" onClick={() => setDevice("mobile")} title="Mobile" className={`p-1.5 ${device === "mobile" ? "bg-gray-100 text-navy-900" : "text-gray-500"}`}><Smartphone className="w-4 h-4" /></button>
            </div>
            <button type="button" onClick={() => { setPreviewing((v) => !v); setSelection(null); }} className={`h-8 px-3 rounded-lg border text-[12px] font-medium flex items-center gap-1.5 ${previewing ? "bg-navy-900 text-white border-navy-900" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
              {previewing ? <><Pencil className="w-3.5 h-3.5" /> Back to editing</> : <><Eye className="w-3.5 h-3.5" /> Preview</>}
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto dgs-dots">
          <Canvas design={design} brand={brand} selection={selection} device={device} previewing={previewing} dragging={dragging}
            onSelect={(sel) => { setSelection(sel); if (sel) setLeftTab("content"); }}
            onChangeBlock={(id, patch) => updateBlock(id, patch)}
            onDrop={onDrop} onDragStart={onCanvasDragStart} onDragEnd={() => setDragging(false)}
            onDuplicate={duplicate} onDelete={remove} onMove={move} />
        </div>
      </div>
      <style>{`.dgs-dots{background-color:#f8fafc;background-image:radial-gradient(#e2e8f0 1px,transparent 1px);background-size:14px 14px;}`}</style>
    </div>
  );
}
