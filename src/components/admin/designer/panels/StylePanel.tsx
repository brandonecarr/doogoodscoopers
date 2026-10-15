"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2, Check, Moon } from "lucide-react";
import {
  type GlobalStyles, type BrandLibrary, type TextRole, type SocialNetwork, SYSTEM_FONTS, GOOGLE_FAMILIES, googleFont, defaultStyles, darkOf, DEFAULT_DARK,
} from "@/lib/email-designer/model";
import { SOCIAL_LABEL } from "@/lib/email-designer/render";
import { PanelSection, Field, NumberInput, ColorInput, Select, Segment, SpacingInput, TextInput, Toggle, inputCls } from "../ui";
import { ImagePicker } from "../ImagePicker";
import { FontSelect } from "./BoxFields";

/* The Style tab: the brand library (editable), then the email-wide settings every
   element inherits from. */

const NETWORKS = Object.keys(SOCIAL_LABEL) as SocialNetwork[];

export function StylePanel({ styles, brand, onChange, onBrandChange, brandSaving, brandSaved }: {
  styles: GlobalStyles; brand: BrandLibrary; onChange: (s: GlobalStyles) => void; onBrandChange: (b: BrandLibrary) => void; brandSaving: boolean; brandSaved: boolean;
}) {
  const [role, setRole] = useState<keyof GlobalStyles["text"]>("paragraph");
  const [libOpen, setLibOpen] = useState(false);
  const set = (patch: Partial<GlobalStyles>) => onChange({ ...styles, ...patch });
  const setRole_ = (patch: Partial<TextRole>) => set({ text: { ...styles.text, [role]: { ...styles.text[role], ...patch } } });
  const r = styles.text[role];
  const dark = darkOf(styles);
  const setDark = (patch: Partial<typeof dark>) => set({ dark: { ...dark, ...patch } });
  const roleLabel: Record<keyof GlobalStyles["text"], string> = { paragraph: "Paragraph", title1: "Title 1", title2: "Title 2", title3: "Title 3" };

  const applyBrand = () => onChange({ ...defaultStyles(brand), bodyWidth: styles.bodyWidth, viewInBrowser: styles.viewInBrowser, preheader: styles.preheader, bodyPadding: styles.bodyPadding });

  return (
    <div className="flex-1 overflow-y-auto">
      <PanelSection title="Brand library" right={<span className="text-[11px] text-gray-400 flex items-center gap-1">{brandSaving ? <><Loader2 className="w-3 h-3 animate-spin" /> saving</> : brandSaved ? <><Check className="w-3 h-3 text-green-600" /> saved</> : null}</span>}>
        <div className="grid grid-cols-4 gap-2 mb-2">
          <div className="h-16 rounded-lg border border-gray-200 bg-white flex items-center justify-center overflow-hidden p-1" title="Logo">{brand.logo ? <img src={brand.logo.url} alt={brand.logo.alt} className="max-h-full max-w-full object-contain" /> : <span className="text-[10px] text-gray-400">No logo</span>}</div>
          <div className="h-16 rounded-lg border border-gray-200 bg-white p-1.5 text-[11px] leading-tight overflow-hidden" title="Fonts"><b style={{ fontFamily: brand.fonts[0]?.family }}>{brand.fonts[0]?.name || "—"}</b><br /><span style={{ fontFamily: brand.fonts[1]?.family }} className="text-gray-500">{brand.fonts[1]?.name || ""}</span></div>
          <div className="h-16 rounded-lg border border-gray-200 bg-white p-1.5 flex flex-wrap gap-1 content-start" title="Colors">{brand.colors.slice(0, 6).map((c) => <span key={c.hex + c.name} className="w-4 h-4 rounded-md border border-gray-200" style={{ background: c.hex }} />)}</div>
          <div className="h-16 rounded-lg border border-gray-200 bg-white p-1.5 flex flex-wrap gap-1 content-start" title="Social">{brand.social.slice(0, 4).map((s) => <img key={s.network} src={`https://oxorxznxhwdortpblfke.supabase.co/storage/v1/object/public/email-assets/social/color/${s.network}.png`} alt={s.network} className="w-5 h-5" />)}{!brand.social.length && <span className="text-[10px] text-gray-400">No social</span>}</div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setLibOpen((o) => !o)} className="h-8 px-3 text-[12px] font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50">{libOpen ? "Close brand library" : "Edit brand library"}</button>
          <button type="button" onClick={applyBrand} className="h-8 px-3 text-[12px] font-medium rounded-lg bg-navy-900 text-white hover:bg-navy-800">Apply brand assets</button>
        </div>
        {libOpen && <BrandEditor brand={brand} onChange={onBrandChange} />}
      </PanelSection>

      <PanelSection title="Layout">
        <Field label="Body width"><NumberInput value={styles.bodyWidth} onChange={(n) => set({ bodyWidth: n ?? 600 })} unit="px" min={320} max={800} width={72} /></Field>
        <Field label="Body color"><ColorInput value={styles.bodyBg} onChange={(c) => set({ bodyBg: c || "#FFFFFF" })} brand={brand.colors} allowEmpty={false} /></Field>
        <Field label="Body corners"><NumberInput value={styles.bodyRadius} onChange={(n) => set({ bodyRadius: n ?? 0 })} unit="px" max={40} width={64} /></Field>
      </PanelSection>
      <PanelSection title="Spacing">
        <SpacingInput label="Padding" value={styles.bodyPadding} onChange={(bodyPadding) => set({ bodyPadding })} hint="Around the whole email, inside the page" />
      </PanelSection>
      <PanelSection title="Background">
        <Field label="Page color" hint="Behind the email body"><ColorInput value={styles.pageBg} onChange={(c) => set({ pageBg: c || "#F6FAFB" })} brand={brand.colors} allowEmpty={false} /></Field>
      </PanelSection>
      <PanelSection title="Header">
        <Field label="Show 'View in browser' link" hint="A hosted copy of the email, personalized for each recipient"><Toggle value={styles.viewInBrowser} onChange={(viewInBrowser) => set({ viewInBrowser })} /></Field>
        <div className="py-1.5">
          <p className="text-[13px] text-gray-700 mb-1">Preheader <span className="text-gray-400">(preview text in the inbox)</span></p>
          <TextInput value={styles.preheader} onChange={(preheader) => set({ preheader })} placeholder="Your rate is locked in, {{firstName}}…" />
        </div>
      </PanelSection>

      <PanelSection title="Dark mode" right={<Toggle value={dark.enabled} onChange={(enabled) => setDark({ enabled })} />}>
        <p className="text-[12px] text-gray-500 flex items-start gap-1.5"><Moon className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {dark.enabled ? "Inboxes in dark mode get these colors instead of the light ones. Any element can override them in its own Dark mode settings; use the moon button above the email to preview." : "Off: inboxes in dark mode show the email as designed (some apps still invert colors on their own)."}</p>
        {dark.enabled && (
          <div className="mt-2">
            <Field label="Page color"><ColorInput value={dark.pageBg} onChange={(c) => setDark({ pageBg: c || DEFAULT_DARK.pageBg })} brand={brand.colors} allowEmpty={false} /></Field>
            <Field label="Body color"><ColorInput value={dark.bodyBg} onChange={(c) => setDark({ bodyBg: c || DEFAULT_DARK.bodyBg })} brand={brand.colors} allowEmpty={false} /></Field>
            <Field label="Section color" hint="Blank keeps each section's own color"><ColorInput value={dark.sectionBg} onChange={(sectionBg) => setDark({ sectionBg })} brand={brand.colors} /></Field>
            <Field label="Text color"><ColorInput value={dark.text} onChange={(c) => setDark({ text: c || DEFAULT_DARK.text })} brand={brand.colors} allowEmpty={false} /></Field>
            <Field label="Link color"><ColorInput value={dark.link} onChange={(c) => setDark({ link: c || DEFAULT_DARK.link })} brand={brand.colors} allowEmpty={false} /></Field>
          </div>
        )}
      </PanelSection>

      <PanelSection title="Text styles">
        <div className="py-1.5"><Select value={role} onChange={setRole} options={(Object.keys(roleLabel) as (keyof GlobalStyles["text"])[]).map((k) => ({ value: k, label: roleLabel[k] }))} width="100%" /></div>
        <div className="py-1.5"><FontSelect value={r.font} onChange={(font) => setRole_({ font: font || SYSTEM_FONTS[0].family })} brand={brand} allowInherit={false} /></div>
        <Field label="Font size"><NumberInput value={r.size} onChange={(n) => setRole_({ size: n ?? 16 })} unit="px" min={8} max={96} width={64} /></Field>
        <Field label="Font color"><ColorInput value={r.color} onChange={(c) => setRole_({ color: c || "#1f2937" })} brand={brand.colors} allowEmpty={false} /></Field>
        <Field label="Line height"><NumberInput value={r.lineHeight} onChange={(n) => setRole_({ lineHeight: n ?? 1.4 })} step={0.1} min={0.8} max={3} width={64} /></Field>
        <Field label="Letter spacing"><NumberInput value={r.letterSpacing} onChange={(n) => setRole_({ letterSpacing: n ?? 0 })} unit="px" min={-3} max={10} step={0.5} width={64} /></Field>
        <Field label="Weight"><Segment value={r.bold ? "bold" : "normal"} onChange={(v) => setRole_({ bold: v === "bold" })} options={[{ value: "bold", label: <b>Bold</b> }, { value: "normal", label: "Regular" }]} /></Field>
      </PanelSection>

      <PanelSection title="Links">
        <Field label="Color"><ColorInput value={styles.link.color} onChange={(c) => set({ link: { ...styles.link, color: c || "#008EFF" } })} brand={brand.colors} allowEmpty={false} /></Field>
        <Field label="Style">
          <Segment value={styles.link.bold ? "b" : "-"} onChange={(v) => set({ link: { ...styles.link, bold: v === "b" } })} options={[{ value: "b", label: <b>B</b> }, { value: "-", label: "–" }]} />
          <Segment value={styles.link.italic ? "i" : "-"} onChange={(v) => set({ link: { ...styles.link, italic: v === "i" } })} options={[{ value: "i", label: <i>I</i> }, { value: "-", label: "–" }]} />
          <Segment value={styles.link.underline ? "u" : "-"} onChange={(v) => set({ link: { ...styles.link, underline: v === "u" } })} options={[{ value: "u", label: <u>U</u> }, { value: "-", label: "–" }]} />
        </Field>
      </PanelSection>

      <PanelSection title="Buttons">
        <div className="py-1.5"><FontSelect value={styles.button.font} onChange={(font) => set({ button: { ...styles.button, font: font || SYSTEM_FONTS[0].family } })} brand={brand} allowInherit={false} /></div>
        <Field label="Font size"><NumberInput value={styles.button.size} onChange={(n) => set({ button: { ...styles.button, size: n ?? 16 } })} unit="px" min={10} max={40} width={64} /></Field>
        <Field label="Font color"><ColorInput value={styles.button.color} onChange={(c) => set({ button: { ...styles.button, color: c || "#FFFFFF" } })} brand={brand.colors} allowEmpty={false} /></Field>
        <Field label="Font weight"><Segment value={styles.button.bold ? "bold" : "normal"} onChange={(v) => set({ button: { ...styles.button, bold: v === "bold" } })} options={[{ value: "bold", label: <b>B</b> }, { value: "normal", label: "Regular" }]} /></Field>
        <Field label="Width"><NumberInput value={styles.button.width} onChange={(width) => set({ button: { ...styles.button, width } })} unit="px" max={600} width={64} placeholder="auto" /></Field>
        <Field label="Rounded corners"><NumberInput value={styles.button.radius} onChange={(n) => set({ button: { ...styles.button, radius: n ?? 0 } })} unit="px" max={60} width={64} /></Field>
        <Field label="Background color"><ColorInput value={styles.button.bg} onChange={(c) => set({ button: { ...styles.button, bg: c || "#008EFF" } })} brand={brand.colors} allowEmpty={false} /></Field>
        <SpacingInput label="Inner padding" value={styles.button.inner} onChange={(inner) => set({ button: { ...styles.button, inner } })} />
        <Field label="Border size"><NumberInput value={styles.button.borderSize} onChange={(n) => set({ button: { ...styles.button, borderSize: n ?? 0 } })} unit="px" max={10} width={64} /></Field>
        <Field label="Border color"><ColorInput value={styles.button.borderColor} onChange={(c) => set({ button: { ...styles.button, borderColor: c || styles.button.bg } })} brand={brand.colors} allowEmpty={false} /></Field>
      </PanelSection>
    </div>
  );
}

function BrandEditor({ brand, onChange }: { brand: BrandLibrary; onChange: (b: BrandLibrary) => void }) {
  const [newFont, setNewFont] = useState("");
  const [newColor, setNewColor] = useState({ name: "", hex: "#" });
  const set = (patch: Partial<BrandLibrary>) => onChange({ ...brand, ...patch });
  const fontOptions = [...SYSTEM_FONTS.map((f) => f.name), ...GOOGLE_FAMILIES].filter((n) => !brand.fonts.some((f) => f.name === n));
  return (
    <div className="mt-3 space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div>
        <p className="text-[12px] font-semibold text-navy-900 mb-1.5">Logo</p>
        <ImagePicker value={brand.logo?.url || ""} onChange={(url) => set({ logo: url ? { url, alt: brand.logo?.alt || "DooGoodScoopers", width: brand.logo?.width || 220 } : null })} label="Logo" />
        {brand.logo && (
          <div className="mt-2 flex items-center gap-3">
            <Field label="Alt text"><TextInput value={brand.logo.alt} onChange={(alt) => set({ logo: { ...brand.logo!, alt } })} width={140} /></Field>
            <Field label="Width"><NumberInput value={brand.logo.width} onChange={(n) => set({ logo: { ...brand.logo!, width: n ?? 220 } })} unit="px" min={40} max={600} width={64} /></Field>
          </div>
        )}
      </div>
      <div>
        <p className="text-[12px] font-semibold text-navy-900 mb-1.5">Fonts <span className="font-normal text-gray-400">(first is the brand default)</span></p>
        <ul className="space-y-1">
          {brand.fonts.map((f, i) => (
            <li key={f.name} className="flex items-center gap-2 text-[13px]">
              <span style={{ fontFamily: f.family }} className="flex-1">{f.name}{i === 0 && <span className="ml-2 text-[10px] uppercase tracking-wide text-violet-700">default</span>}</span>
              {i > 0 && <button type="button" title="Make default" onClick={() => set({ fonts: [f, ...brand.fonts.filter((x) => x !== f)] })} className="text-[11px] text-gray-500 hover:text-violet-700">make default</button>}
              <button type="button" onClick={() => set({ fonts: brand.fonts.filter((x) => x !== f) })} disabled={brand.fonts.length <= 1} className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
        <div className="mt-1.5 flex gap-1.5">
          <select value={newFont} onChange={(e) => setNewFont(e.target.value)} className={`${inputCls} flex-1`}>
            <option value="">Add a font…</option>
            <optgroup label="System">{SYSTEM_FONTS.filter((f) => fontOptions.includes(f.name)).map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}</optgroup>
            <optgroup label="Google Fonts">{GOOGLE_FAMILIES.filter((n) => fontOptions.includes(n)).map((n) => <option key={n} value={n}>{n}</option>)}</optgroup>
          </select>
          <button type="button" disabled={!newFont} onClick={() => { const sys = SYSTEM_FONTS.find((f) => f.name === newFont); set({ fonts: [...brand.fonts, sys || googleFont(newFont)] }); setNewFont(""); }} className="h-8 px-2.5 rounded-lg bg-white border border-gray-200 text-[12px] disabled:opacity-40"><Plus className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div>
        <p className="text-[12px] font-semibold text-navy-900 mb-1.5">Colors</p>
        <ul className="space-y-1">
          {brand.colors.map((c, i) => (
            <li key={i} className="flex items-center gap-2 text-[13px]">
              <span className="w-5 h-5 rounded-md border border-gray-200" style={{ background: c.hex }} />
              <input value={c.name} onChange={(e) => set({ colors: brand.colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} className={`${inputCls} flex-1 h-7`} />
              <input value={c.hex} onChange={(e) => set({ colors: brand.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)) })} className={`${inputCls} w-24 h-7 font-mono text-[12px]`} />
              <button type="button" onClick={() => set({ colors: brand.colors.filter((_, j) => j !== i) })} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
        <div className="mt-1.5 flex gap-1.5 items-center">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(newColor.hex) ? newColor.hex : "#000000"} onChange={(e) => setNewColor({ ...newColor, hex: e.target.value })} className="w-8 h-8 p-0 border-0 bg-transparent cursor-pointer" />
          <input value={newColor.name} onChange={(e) => setNewColor({ ...newColor, name: e.target.value })} placeholder="Name" className={`${inputCls} flex-1`} />
          <input value={newColor.hex} onChange={(e) => setNewColor({ ...newColor, hex: e.target.value })} placeholder="#hex" className={`${inputCls} w-24 font-mono text-[12px]`} />
          <button type="button" disabled={!/^#[0-9a-f]{3,8}$/i.test(newColor.hex)} onClick={() => { set({ colors: [...brand.colors, { name: newColor.name || "Color", hex: newColor.hex }] }); setNewColor({ name: "", hex: "#" }); }} className="h-8 px-2.5 rounded-lg bg-white border border-gray-200 text-[12px] disabled:opacity-40"><Plus className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div>
        <p className="text-[12px] font-semibold text-navy-900 mb-1.5">Social links</p>
        <ul className="space-y-1">
          {brand.social.map((s, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <Select value={s.network} onChange={(network) => set({ social: brand.social.map((x, j) => (j === i ? { ...x, network } : x)) })} options={NETWORKS.map((n) => ({ value: n, label: SOCIAL_LABEL[n] }))} width={118} />
              <input value={s.url} onChange={(e) => set({ social: brand.social.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} className={`${inputCls} flex-1 min-w-0 text-[12px]`} placeholder="https://…" />
              <button type="button" onClick={() => set({ social: brand.social.filter((_, j) => j !== i) })} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => set({ social: [...brand.social, { network: "facebook", url: "https://" }] })} className="mt-1.5 text-[12px] text-violet-700 hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add social link</button>
      </div>
      <div>
        <p className="text-[12px] font-semibold text-navy-900 mb-1.5">Navigation links</p>
        <ul className="space-y-1">
          {brand.links.map((l, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <input value={l.label} onChange={(e) => set({ links: brand.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} className={`${inputCls} w-28 text-[12px]`} placeholder="Label" />
              <input value={l.href} onChange={(e) => set({ links: brand.links.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)) })} className={`${inputCls} flex-1 min-w-0 text-[12px]`} placeholder="https://…" />
              <button type="button" onClick={() => set({ links: brand.links.filter((_, j) => j !== i) })} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => set({ links: [...brand.links, { label: "Link", href: "https://" }] })} className="mt-1.5 text-[12px] text-violet-700 hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add link</button>
      </div>
      <div>
        <p className="text-[12px] font-semibold text-navy-900 mb-1.5">Postal address <span className="font-normal text-gray-400">(footers)</span></p>
        <TextInput value={brand.address} onChange={(address) => set({ address })} />
      </div>
    </div>
  );
}
