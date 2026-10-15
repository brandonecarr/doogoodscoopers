"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlignLeft, AlignCenter, AlignRight, ChevronDown, Link as LinkIcon, Unlink, HelpCircle } from "lucide-react";
import type { Align, VAlign, Spacing, Border, BrandColor } from "@/lib/email-designer/model";

/* Small form controls for the designer panels: one visual language everywhere. */

export const row = "flex items-center justify-between gap-3 py-1.5";
export const labelCls = "text-[13px] text-gray-700";
export const inputCls = "h-8 px-2 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400";

export function PanelSection({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-gray-100">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[13px] font-semibold text-navy-900">{title}</p>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className={row}>
      <span className={`${labelCls} flex items-center gap-1`}>{label}{hint && <span title={hint}><HelpCircle className="w-3.5 h-3.5 text-gray-400" /></span>}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

export function NumberInput({ value, onChange, min = 0, max = 2000, step = 1, unit, width = 76, placeholder }: { value: number | null | undefined; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; unit?: string; width?: number; placeholder?: string }) {
  return (
    <span className="inline-flex items-center">
      <input type="number" value={value ?? ""} min={min} max={max} step={step} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : Math.min(max, Math.max(min, Number(e.target.value))))}
        className={`${inputCls} ${unit ? "rounded-r-none" : ""}`} style={{ width }} />
      {unit && <span className="h-8 px-2 inline-flex items-center text-[12px] text-gray-500 border border-l-0 border-gray-200 rounded-r-lg bg-gray-50">{unit}</span>}
    </span>
  );
}

export function TextInput({ value, onChange, placeholder, width, mono }: { value: string; onChange: (v: string) => void; placeholder?: string; width?: number | string; mono?: boolean }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputCls} ${mono ? "font-mono text-[12px]" : ""}`} style={{ width: width ?? "100%" }} />;
}

export function Select<T extends string>({ value, onChange, options, width = 160 }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; width?: number | string }) {
  return (
    <span className="relative inline-flex">
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={`${inputCls} appearance-none pr-7`} style={{ width }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
    </span>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)}
      className={`relative w-10 h-6 rounded-full transition-colors ${value ? "bg-violet-600" : "bg-gray-300"}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
  );
}

export function Segment<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; title?: string }[] }) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
      {options.map((o) => (
        <button key={o.value} type="button" title={o.title} onClick={() => onChange(o.value)}
          className={`h-8 px-2.5 text-[12px] font-medium flex items-center justify-center min-w-[34px] ${value === o.value ? "bg-violet-100 text-violet-700" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AlignGroup({ value, onChange }: { value: Align; onChange: (v: Align) => void }) {
  return <Segment value={value} onChange={onChange} options={[
    { value: "left", label: <AlignLeft className="w-4 h-4" />, title: "Left" },
    { value: "center", label: <AlignCenter className="w-4 h-4" />, title: "Center" },
    { value: "right", label: <AlignRight className="w-4 h-4" />, title: "Right" },
  ]} />;
}

export function VAlignGroup({ value, onChange }: { value: VAlign; onChange: (v: VAlign) => void }) {
  return <Segment value={value} onChange={onChange} options={[
    { value: "top", label: "Top" }, { value: "middle", label: "Middle" }, { value: "bottom", label: "Bottom" },
  ]} />;
}

/** Color swatch + hex field with the brand palette underneath. */
export function ColorInput({ value, onChange, brand = [], allowEmpty = true }: { value: string | null | undefined; onChange: (v: string | null) => void; brand?: BrandColor[]; allowEmpty?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const v = value || "";
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} title={v || "None"}
        className="w-8 h-8 rounded-full border border-gray-300 shadow-inner"
        style={v ? { background: v } : { backgroundImage: "repeating-conic-gradient(#e5e7eb 0 25%, #fff 0 50%)", backgroundSize: "10px 10px" }} />
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-56 p-3 rounded-xl border border-gray-200 bg-white shadow-xl space-y-2">
          <div className="flex items-center gap-2">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(v) ? v : "#000000"} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 p-0 border-0 bg-transparent cursor-pointer" />
            <input value={v} onChange={(e) => onChange(e.target.value || null)} placeholder="#000000" className={`${inputCls} flex-1 font-mono text-[12px]`} />
          </div>
          {brand.length > 0 && (
            <div>
              <p className="text-[11px] text-gray-400 mb-1">Brand colors</p>
              <div className="flex flex-wrap gap-1.5">
                {brand.map((c) => (
                  <button key={c.hex + c.name} type="button" title={`${c.name} ${c.hex}`} onClick={() => onChange(c.hex)}
                    className={`w-6 h-6 rounded-full border ${v.toLowerCase() === c.hex.toLowerCase() ? "ring-2 ring-violet-500 border-white" : "border-gray-200"}`} style={{ background: c.hex }} />
                ))}
              </div>
            </div>
          )}
          {allowEmpty && <button type="button" onClick={() => { onChange(null); setOpen(false); }} className="text-[12px] text-gray-500 hover:text-navy-900">No color</button>}
        </div>
      )}
    </div>
  );
}

/** Four-sided spacing with a "group sides" link (top/bottom and left/right move together). */
export function SpacingInput({ label, value, onChange, hint }: { label: string; value: Spacing; onChange: (v: Spacing) => void; hint?: string }) {
  const [grouped, setGrouped] = useState(value.top === value.bottom && value.left === value.right);
  const set = (k: keyof Spacing, n: number | null) => {
    const v = n ?? 0;
    if (grouped) {
      if (k === "top" || k === "bottom") onChange({ ...value, top: v, bottom: v });
      else onChange({ ...value, left: v, right: v });
    } else onChange({ ...value, [k]: v });
  };
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between">
        <span className={`${labelCls} flex items-center gap-1`}>{label}{hint && <span title={hint}><HelpCircle className="w-3.5 h-3.5 text-gray-400" /></span>}</span>
        <label className="flex items-center gap-1.5 text-[12px] text-gray-600">
          Group sides <button type="button" onClick={() => setGrouped((g) => !g)} className={`p-0.5 rounded ${grouped ? "text-violet-700" : "text-gray-400"}`}>{grouped ? <LinkIcon className="w-3.5 h-3.5" /> : <Unlink className="w-3.5 h-3.5" />}</button>
        </label>
      </div>
      {grouped ? (
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          <Field label="↕"><NumberInput value={value.top} onChange={(n) => set("top", n)} unit="px" width={64} /></Field>
          <Field label="↔"><NumberInput value={value.left} onChange={(n) => set("left", n)} unit="px" width={64} /></Field>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          <Field label="Top"><NumberInput value={value.top} onChange={(n) => set("top", n)} unit="px" width={64} /></Field>
          <Field label="Right"><NumberInput value={value.right} onChange={(n) => set("right", n)} unit="px" width={64} /></Field>
          <Field label="Bottom"><NumberInput value={value.bottom} onChange={(n) => set("bottom", n)} unit="px" width={64} /></Field>
          <Field label="Left"><NumberInput value={value.left} onChange={(n) => set("left", n)} unit="px" width={64} /></Field>
        </div>
      )}
    </div>
  );
}

export function BorderInput({ value, onChange, brand }: { value: Border | null; onChange: (v: Border | null) => void; brand: BrandColor[] }) {
  const b = value ?? { size: 0, color: "#E1E9EC", style: "solid" as const };
  const set = (patch: Partial<Border>) => { const next = { ...b, ...patch }; onChange(next.size > 0 ? next : null); };
  return (
    <>
      <Field label="Size"><NumberInput value={b.size} onChange={(n) => set({ size: n ?? 0 })} unit="px" max={20} width={64} /></Field>
      <Field label="Style"><Select value={b.style} onChange={(v) => set({ style: v })} options={[{ value: "solid", label: "Solid" }, { value: "dashed", label: "Dashed" }, { value: "dotted", label: "Dotted" }]} width={110} /></Field>
      <Field label="Color"><ColorInput value={b.color} onChange={(c) => set({ color: c || "#E1E9EC" })} brand={brand} allowEmpty={false} /></Field>
    </>
  );
}

/** Editable name with a pencil, used in every panel header. */
export function NameEditor({ value, placeholder, onChange }: { value: string | undefined; placeholder: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  if (editing) {
    return (
      <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder}
        onBlur={() => { setEditing(false); onChange(draft.trim()); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setDraft(value || ""); setEditing(false); } }}
        className={`${inputCls} w-full font-semibold`} />
    );
  }
  return (
    <button type="button" onClick={() => { setDraft(value || ""); setEditing(true); }} title="Rename" className="group inline-flex items-center gap-1.5 text-[15px] font-semibold text-navy-900 hover:underline underline-offset-4 decoration-dotted">
      {value || placeholder}
      <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
    </button>
  );
}
