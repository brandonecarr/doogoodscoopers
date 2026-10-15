"use client";

import { X, Plus, Trash2 } from "lucide-react";
import { type Section, type Column, type BrandLibrary, newColumn } from "@/lib/email-designer/model";
import { PanelSection, Field, NumberInput, Toggle, NameEditor, VAlignGroup, inputCls } from "../ui";
import { BoxFields } from "./BoxFields";

/* Settings for a section (row of columns) or a single column. */

export function SectionPanel({ section, brand, onChange, onClose }: { section: Section; brand: BrandLibrary; onChange: (patch: Partial<Section>) => void; onClose: () => void }) {
  const setWidth = (i: number, w: number) => {
    const cols = section.columns.map((c, j) => (j === i ? { ...c, width: w } : c));
    onChange({ columns: cols });
  };
  const total = section.columns.reduce((n, c) => n + c.width, 0);
  const addColumn = () => {
    const n = section.columns.length + 1;
    const even = Math.floor(100 / n);
    const cols = [...section.columns.map((c) => ({ ...c, width: even })), newColumn(100 - even * (n - 1))];
    onChange({ columns: cols });
  };
  const removeColumn = (i: number) => {
    if (section.columns.length <= 1) return;
    const rest = section.columns.filter((_, j) => j !== i);
    const even = Math.floor(100 / rest.length);
    onChange({ columns: rest.map((c, j) => ({ ...c, width: j === rest.length - 1 ? 100 - even * (rest.length - 1) : even })) });
  };
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] uppercase tracking-wider text-gray-400 shrink-0">Section</span>
          <NameEditor value={section.name} placeholder="Section" onChange={(name) => onChange({ name: name || undefined })} />
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Close"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <PanelSection title="Layout">
          <Field label="Vertical alignment" hint="Where shorter columns sit next to taller ones"><VAlignGroup value={section.vAlign} onChange={(vAlign) => onChange({ vAlign, columns: section.columns.map((c) => ({ ...c, vAlign })) })} /></Field>
          <Field label="Space between columns"><NumberInput value={section.columnGap} onChange={(n) => onChange({ columnGap: n ?? 0 })} unit="px" max={60} width={64} /></Field>
          <Field label="Stack on mobile" hint="Columns go one above the other on phones"><Toggle value={section.stackOnMobile} onChange={(stackOnMobile) => onChange({ stackOnMobile })} /></Field>
          <Field label="Background full width" hint="Paint the section color edge to edge behind the email"><Toggle value={section.fullWidthBg} onChange={(fullWidthBg) => onChange({ fullWidthBg })} /></Field>
        </PanelSection>
        <PanelSection title="Columns" right={section.columns.length < 4 ? <button type="button" onClick={addColumn} className="text-[12px] text-violet-700 hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add column</button> : null}>
          <div className="space-y-1.5">
            {section.columns.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2">
                <span className="text-[12px] text-gray-600 w-20 truncate">{c.name || `Column ${i + 1}`}</span>
                <input type="range" min={10} max={90} value={c.width} onChange={(e) => setWidth(i, Number(e.target.value))} className="flex-1 accent-violet-600" />
                <input type="number" min={10} max={100} value={c.width} onChange={(e) => setWidth(i, Number(e.target.value))} className={`${inputCls} w-16`} />
                <span className="text-[12px] text-gray-400">%</span>
                <button type="button" onClick={() => removeColumn(i)} disabled={section.columns.length <= 1} title="Remove column" className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          {total !== 100 && <p className="text-[11px] text-amber-700 mt-1.5">Widths add up to {total}%. Make them total 100% so columns fill the row.</p>}
        </PanelSection>
        <BoxFields box={section} brand={brand} onChange={onChange} />
      </div>
    </div>
  );
}

export function ColumnPanel({ column, brand, onChange, onClose }: { column: Column; brand: BrandLibrary; onChange: (patch: Partial<Column>) => void; onClose: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] uppercase tracking-wider text-gray-400 shrink-0">Column</span>
          <NameEditor value={column.name} placeholder="Column" onChange={(name) => onChange({ name: name || undefined })} />
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Close"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <PanelSection title="Layout">
          <Field label="Width"><NumberInput value={column.width} onChange={(n) => onChange({ width: n ?? 50 })} unit="%" min={10} max={100} width={64} /></Field>
          <Field label="Vertical alignment"><VAlignGroup value={column.vAlign} onChange={(vAlign) => onChange({ vAlign })} /></Field>
        </PanelSection>
        <BoxFields box={column} brand={brand} onChange={onChange} />
      </div>
    </div>
  );
}
