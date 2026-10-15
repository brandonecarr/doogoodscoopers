"use client";

import { Monitor, Smartphone, MonitorSmartphone, Moon } from "lucide-react";
import type { Box, BrandLibrary, Condition, TextStyle } from "@/lib/email-designer/model";
import { SYSTEM_FONTS, GOOGLE_FAMILIES, googleFamily } from "@/lib/email-designer/model";
import { PanelSection, Field, NumberInput, ColorInput, SpacingInput, BorderInput, Segment, Select, inputCls } from "../ui";
import { TOKENS } from "../RichText";

/* Settings every element and container shares: spacing, background, corners,
   borders, which devices show it, and a show-condition on a personalization token. */

export function BoxFields({ box, brand, onChange, showBackground = true, darkEnabled = false }: { box: Box; brand: BrandLibrary; onChange: (patch: Partial<Box>) => void; showBackground?: boolean; darkEnabled?: boolean }) {
  const cond: Condition | null = box.condition;
  const dark = box.dark || {};
  const setDark = (patch: { background?: string | null; color?: string | null }) => {
    const next = { ...dark, ...patch };
    onChange({ dark: next.background || next.color ? next : undefined });
  };
  return (
    <>
      <PanelSection title="Spacing">
        <SpacingInput label="Padding" value={box.padding} onChange={(padding) => onChange({ padding })} hint="Space inside, between the edge and the content" />
        <SpacingInput label="Margin" value={box.margin} onChange={(margin) => onChange({ margin })} hint="Space outside, around the element" />
      </PanelSection>
      {showBackground && (
        <PanelSection title="Background">
          <Field label="Color"><ColorInput value={box.background} onChange={(background) => onChange({ background })} brand={brand.colors} /></Field>
        </PanelSection>
      )}
      <PanelSection title="Rounded corners">
        <Field label="Radius"><NumberInput value={box.radius} onChange={(n) => onChange({ radius: n ?? 0 })} unit="px" max={80} width={64} /></Field>
        {box.radius > 0 && <Field label="Corners"><Segment value={box.radiusCorners || "all"} onChange={(radiusCorners) => onChange({ radiusCorners })} options={[{ value: "all", label: "All" }, { value: "top", label: "Top" }, { value: "bottom", label: "Bottom" }]} /></Field>}
      </PanelSection>
      <PanelSection title="Borders">
        <BorderInput value={box.border} onChange={(border) => onChange({ border })} brand={brand.colors} />
        {box.border && box.border.size > 0 && (
          <Field label="Sides">
            <div className="flex gap-1">
              {(["top", "right", "bottom", "left"] as const).map((side) => {
                const sides = box.border!.sides && box.border!.sides.length ? box.border!.sides : (["top", "right", "bottom", "left"] as const);
                const on = sides.includes(side);
                return <button key={side} type="button" title={side} onClick={() => onChange({ border: { ...box.border!, sides: on ? sides.filter((s) => s !== side) : [...sides, side] } })} className={`h-7 px-2 text-[11px] rounded-md border ${on ? "bg-violet-100 border-violet-300 text-violet-700" : "bg-white border-gray-200 text-gray-400"}`}>{side[0].toUpperCase()}</button>;
              })}
            </div>
          </Field>
        )}
      </PanelSection>
      {darkEnabled && (
        <PanelSection title="Dark mode">
          <p className="text-[12px] text-gray-500 mb-1 flex items-center gap-1"><Moon className="w-3.5 h-3.5" /> Colors for inboxes in dark mode. Blank keeps the email-wide dark colors.</p>
          <Field label="Background"><ColorInput value={dark.background ?? null} onChange={(background) => setDark({ background })} brand={brand.colors} /></Field>
          <Field label="Text color"><ColorInput value={dark.color ?? null} onChange={(color) => setDark({ color })} brand={brand.colors} /></Field>
        </PanelSection>
      )}
      <PanelSection title="Content visibility">
        <p className="text-[12px] text-gray-500 mb-2">Display or hide based on the type of device or a condition.</p>
        <p className="text-[12px] text-gray-700 mb-1">Show on:</p>
        <Segment value={box.visibility} onChange={(visibility) => onChange({ visibility })} options={[
          { value: "all", label: <span className="flex items-center gap-1"><MonitorSmartphone className="w-3.5 h-3.5" /> All devices</span> },
          { value: "desktop", label: <span className="flex items-center gap-1"><Monitor className="w-3.5 h-3.5" /> Only on desktop</span> },
          { value: "mobile", label: <span className="flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /> Only on mobile</span> },
        ]} />
        <div className="mt-3">
          <p className="text-[12px] text-gray-700 mb-1">Display condition</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Select value={cond ? cond.when : "always"} onChange={(v) => onChange({ condition: v === "always" ? null : { token: cond?.token || "coupon", when: v as Condition["when"] } })}
              options={[{ value: "always", label: "Always show" }, { value: "present", label: "Only when the token has a value" }, { value: "absent", label: "Only when the token is empty" }]} width={220} />
            {cond && (
              <Select value={cond.token} onChange={(token) => onChange({ condition: { ...cond, token } })} options={TOKENS.map((t) => ({ value: t, label: `{{${t}}}` }))} width={150} />
            )}
          </div>
          {cond && <p className="text-[11px] text-gray-400 mt-1">Checked per recipient when the email is sent.</p>}
        </div>
      </PanelSection>
    </>
  );
}

/** Font picker: brand fonts first, then system and Google families. */
export function FontSelect({ value, onChange, brand, allowInherit = true }: { value: string | undefined; onChange: (family: string | undefined) => void; brand: BrandLibrary; allowInherit?: boolean }) {
  const brandFams = brand.fonts.map((f) => f.family);
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value || undefined)} className={`${inputCls} w-full`}>
      {allowInherit && <option value="">Inherit from style</option>}
      <optgroup label="Brand fonts">{brand.fonts.map((f) => <option key={f.name} value={f.family}>{f.name}</option>)}</optgroup>
      <optgroup label="System">{SYSTEM_FONTS.filter((f) => !brandFams.includes(f.family)).map((f) => <option key={f.name} value={f.family}>{f.name}</option>)}</optgroup>
      <optgroup label="Google Fonts">{GOOGLE_FAMILIES.filter((n) => !brandFams.includes(googleFamily(n))).map((n) => <option key={n} value={googleFamily(n)}>{n}</option>)}</optgroup>
    </select>
  );
}

/** Per-element text overrides (empty = inherit from the Style tab). */
export function TextStyleFields({ style, brand, onChange, inheritHint }: { style: TextStyle; brand: BrandLibrary; onChange: (s: TextStyle) => void; inheritHint: string }) {
  const set = (patch: TextStyle) => onChange({ ...style, ...patch });
  return (
    <PanelSection title="Text style">
      <p className="text-[11px] text-gray-400 mb-2">Blank fields inherit from {inheritHint} in the Style tab.</p>
      <div className="py-1.5"><FontSelect value={style.font} onChange={(font) => set({ font })} brand={brand} /></div>
      <Field label="Font size"><NumberInput value={style.size ?? null} onChange={(n) => set({ size: n ?? undefined })} unit="px" min={8} max={96} width={64} placeholder="—" /></Field>
      <Field label="Font color"><ColorInput value={style.color} onChange={(c) => set({ color: c || undefined })} brand={brand.colors} /></Field>
      <Field label="Line height"><NumberInput value={style.lineHeight ?? null} onChange={(n) => set({ lineHeight: n ?? undefined })} step={0.1} min={0.8} max={3} width={64} placeholder="—" /></Field>
      <Field label="Letter spacing"><NumberInput value={style.letterSpacing ?? null} onChange={(n) => set({ letterSpacing: n ?? undefined })} unit="px" min={-3} max={10} step={0.5} width={64} placeholder="—" /></Field>
      <Field label="Weight / style">
        <Segment value={style.bold === undefined ? "inherit" : style.bold ? "bold" : "normal"} onChange={(v) => set({ bold: v === "inherit" ? undefined : v === "bold" })} options={[{ value: "inherit", label: "Auto" }, { value: "bold", label: <b>B</b> }, { value: "normal", label: "Regular" }]} />
      </Field>
      <Field label="Italic / caps">
        <Segment value={style.italic ? "italic" : "normal"} onChange={(v) => set({ italic: v === "italic" })} options={[{ value: "normal", label: "a" }, { value: "italic", label: <i>a</i> }]} />
        <Segment value={style.uppercase ? "upper" : "normal"} onChange={(v) => set({ uppercase: v === "upper" })} options={[{ value: "normal", label: "Aa" }, { value: "upper", label: "AA" }]} />
      </Field>
    </PanelSection>
  );
}
