"use client";

import { Plus, Trash2, X } from "lucide-react";
import { type Block, type BrandLibrary, type GlobalStyles, type SocialNetwork, BLOCK_LABEL, spacing } from "@/lib/email-designer/model";
import { SOCIAL_LABEL } from "@/lib/email-designer/render";
import { PanelSection, Field, NumberInput, TextInput, ColorInput, Select, AlignGroup, Toggle, SpacingInput, BorderInput, NameEditor, Segment, inputCls } from "../ui";
import { ImagePicker } from "../ImagePicker";
import { BoxFields, TextStyleFields, FontSelect } from "./BoxFields";
import { TOKENS } from "../RichText";

/* The settings of whatever block is selected: only its own fields, then the shared box fields. */

const NETWORKS = Object.keys(SOCIAL_LABEL) as SocialNetwork[];

export function BlockPanel({ block, styles, brand, onChange, onClose }: { block: Block; styles: GlobalStyles; brand: BrandLibrary; onChange: (patch: Partial<Block>) => void; onClose: () => void }) {
  const set = (patch: Partial<Block>) => onChange(patch);
  const b = block;
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] uppercase tracking-wider text-gray-400 shrink-0">{BLOCK_LABEL[b.type]}</span>
          <NameEditor value={b.name} placeholder={BLOCK_LABEL[b.type]} onChange={(name) => set({ name: name || undefined })} />
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Close"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {specific(b, styles, brand, set)}
        <BoxFields box={b} brand={brand} onChange={set} />
      </div>
    </div>
  );
}

function specific(b: Block, styles: GlobalStyles, brand: BrandLibrary, set: (patch: Partial<Block>) => void) {
  switch (b.type) {
    case "title":
      return (
        <>
          <PanelSection title="Title">
            <Field label="Level"><Segment value={String(b.level)} onChange={(v) => set({ level: Number(v) as 1 | 2 | 3 } as Partial<Block>)} options={[{ value: "1", label: "H1" }, { value: "2", label: "H2" }, { value: "3", label: "H3" }]} /></Field>
            <Field label="Alignment"><AlignGroup value={b.align} onChange={(align) => set({ align } as Partial<Block>)} /></Field>
            <p className="text-[11px] text-gray-400 mt-1">Click the title on the canvas to edit its words.</p>
          </PanelSection>
          <TextStyleFields style={b.style} brand={brand} onChange={(style) => set({ style } as Partial<Block>)} inheritHint={`Title ${b.level}`} />
        </>
      );
    case "text":
      return (
        <>
          <PanelSection title="Text">
            <Field label="Alignment"><AlignGroup value={b.align} onChange={(align) => set({ align } as Partial<Block>)} /></Field>
            <p className="text-[11px] text-gray-400 mt-1">Click the text on the canvas to edit it; the toolbar adds bold, links and tokens.</p>
          </PanelSection>
          <TextStyleFields style={b.style} brand={brand} onChange={(style) => set({ style } as Partial<Block>)} inheritHint="Paragraph" />
        </>
      );
    case "dynamic":
      return (
        <>
          <PanelSection title="Dynamic content">
            <p className="text-[12px] text-gray-500 mb-2">Shows a personalization value for each recipient.</p>
            <Field label="Token"><Select value={b.token} onChange={(token) => set({ token } as Partial<Block>)} options={TOKENS.map((t) => ({ value: t, label: `{{${t}}}` }))} width={170} /></Field>
            <Field label="Text before"><TextInput value={b.prefix} onChange={(prefix) => set({ prefix } as Partial<Block>)} width={170} /></Field>
            <Field label="Text after"><TextInput value={b.suffix} onChange={(suffix) => set({ suffix } as Partial<Block>)} width={170} /></Field>
            <Field label="Alignment"><AlignGroup value={b.align} onChange={(align) => set({ align } as Partial<Block>)} /></Field>
          </PanelSection>
          <TextStyleFields style={b.style} brand={brand} onChange={(style) => set({ style } as Partial<Block>)} inheritHint="Paragraph" />
        </>
      );
    case "image":
      return (
        <>
          <PanelSection title="Visual">
            <ImagePicker value={b.src} onChange={(src) => set({ src } as Partial<Block>)} />
            <Field label="Alt text"><TextInput value={b.alt} onChange={(alt) => set({ alt } as Partial<Block>)} width={170} /></Field>
          </PanelSection>
          <PanelSection title="Link">
            <Field label="Target"><TextInput value={b.href} onChange={(href) => set({ href } as Partial<Block>)} placeholder="https://… or {{resumeLink}}" width={190} /></Field>
          </PanelSection>
          <PanelSection title="Layout">
            <Field label="Width">
              <NumberInput value={b.width} onChange={(width) => set({ width } as Partial<Block>)} max={b.widthUnit === "%" ? 100 : 1200} width={64} placeholder="auto" />
              <Select value={b.widthUnit} onChange={(widthUnit) => set({ widthUnit } as Partial<Block>)} options={[{ value: "px", label: "px" }, { value: "%", label: "%" }]} width={64} />
            </Field>
            <Field label="Alignment"><AlignGroup value={b.align} onChange={(align) => set({ align } as Partial<Block>)} /></Field>
            <Field label="Image corners"><NumberInput value={b.imageRadius} onChange={(n) => set({ imageRadius: n ?? 0 } as Partial<Block>)} unit="px" max={80} width={64} /></Field>
          </PanelSection>
        </>
      );
    case "logo":
      return (
        <>
          <PanelSection title="Visual" right={brand.logo ? <button type="button" onClick={() => set({ src: brand.logo!.url, alt: brand.logo!.alt, width: brand.logo!.width } as Partial<Block>)} className="text-[12px] text-violet-700 hover:underline">Use brand logo</button> : null}>
            <ImagePicker value={b.src} onChange={(src) => set({ src } as Partial<Block>)} label="Logo" />
            <Field label="Alt text"><TextInput value={b.alt} onChange={(alt) => set({ alt } as Partial<Block>)} width={170} /></Field>
          </PanelSection>
          <PanelSection title="Link">
            <Field label="Target"><TextInput value={b.href} onChange={(href) => set({ href } as Partial<Block>)} placeholder="https://doogoodscoopers.com" width={190} /></Field>
          </PanelSection>
          <PanelSection title="Layout">
            <Field label="Width"><NumberInput value={b.width} onChange={(n) => set({ width: n ?? 200 } as Partial<Block>)} unit="px" min={40} max={600} width={64} /></Field>
            <Field label="Alignment"><AlignGroup value={b.align} onChange={(align) => set({ align } as Partial<Block>)} /></Field>
          </PanelSection>
        </>
      );
    case "button":
      return (
        <>
          <PanelSection title="Button">
            <Field label="Label"><TextInput value={b.label} onChange={(label) => set({ label } as Partial<Block>)} width={190} /></Field>
            <Field label="Link"><TextInput value={b.href} onChange={(href) => set({ href } as Partial<Block>)} placeholder="https://… or {{resumeLink}}" width={190} /></Field>
            <Field label="Alignment"><AlignGroup value={b.align} onChange={(align) => set({ align } as Partial<Block>)} /></Field>
            <Field label="Width">
              <NumberInput value={b.width} onChange={(width) => set({ width } as Partial<Block>)} max={b.widthUnit === "%" ? 100 : 600} width={64} placeholder="auto" />
              <Select value={b.widthUnit} onChange={(widthUnit) => set({ widthUnit } as Partial<Block>)} options={[{ value: "px", label: "px" }, { value: "%", label: "%" }]} width={64} />
            </Field>
            <SpacingInput label="Inner padding" value={b.inner} onChange={(inner) => set({ inner } as Partial<Block>)} />
          </PanelSection>
          <PanelSection title="Button style">
            <p className="text-[11px] text-gray-400 mb-2">Blank fields inherit from Buttons in the Style tab.</p>
            <div className="py-1.5"><FontSelect value={b.style.font} onChange={(font) => set({ style: { ...b.style, font } } as Partial<Block>)} brand={brand} /></div>
            <Field label="Font size"><NumberInput value={b.style.size ?? null} onChange={(n) => set({ style: { ...b.style, size: n ?? undefined } } as Partial<Block>)} unit="px" min={10} max={40} width={64} placeholder="—" /></Field>
            <Field label="Font color"><ColorInput value={b.style.color} onChange={(c) => set({ style: { ...b.style, color: c || undefined } } as Partial<Block>)} brand={brand.colors} /></Field>
            <Field label="Weight"><Segment value={b.style.bold === undefined ? "inherit" : b.style.bold ? "bold" : "normal"} onChange={(v) => set({ style: { ...b.style, bold: v === "inherit" ? undefined : v === "bold" } } as Partial<Block>)} options={[{ value: "inherit", label: "Auto" }, { value: "bold", label: <b>B</b> }, { value: "normal", label: "Regular" }]} /></Field>
            <Field label="Background"><ColorInput value={b.buttonBg} onChange={(c) => set({ buttonBg: c || undefined } as Partial<Block>)} brand={brand.colors} /></Field>
            <Field label="Rounded corners"><NumberInput value={b.buttonRadius ?? null} onChange={(n) => set({ buttonRadius: n ?? undefined } as Partial<Block>)} unit="px" max={60} width={64} placeholder={String(styles.button.radius)} /></Field>
            <p className="text-[12px] text-gray-700 mt-2 mb-1">Button border</p>
            <BorderInput value={b.buttonBorder} onChange={(buttonBorder) => set({ buttonBorder } as Partial<Block>)} brand={brand.colors} />
          </PanelSection>
        </>
      );
    case "divider":
      return (
        <PanelSection title="Divider">
          <Field label="Color"><ColorInput value={b.color} onChange={(c) => set({ color: c || "#E1E9EC" } as Partial<Block>)} brand={brand.colors} allowEmpty={false} /></Field>
          <Field label="Thickness"><NumberInput value={b.thickness} onChange={(n) => set({ thickness: n ?? 1 } as Partial<Block>)} unit="px" min={1} max={20} width={64} /></Field>
          <Field label="Width"><NumberInput value={b.width} onChange={(n) => set({ width: n ?? 100 } as Partial<Block>)} unit="%" min={5} max={100} width={64} /></Field>
          <Field label="Line"><Select value={b.lineStyle} onChange={(lineStyle) => set({ lineStyle } as Partial<Block>)} options={[{ value: "solid", label: "Solid" }, { value: "dashed", label: "Dashed" }, { value: "dotted", label: "Dotted" }]} width={110} /></Field>
          <Field label="Alignment"><AlignGroup value={b.align} onChange={(align) => set({ align } as Partial<Block>)} /></Field>
        </PanelSection>
      );
    case "spacer":
      return (
        <PanelSection title="Spacer">
          <Field label="Height"><NumberInput value={b.height} onChange={(n) => set({ height: n ?? 8 } as Partial<Block>)} unit="px" min={2} max={300} width={64} /></Field>
        </PanelSection>
      );
    case "social":
      return (
        <PanelSection title="Social links" right={<button type="button" onClick={() => set({ items: [...b.items, { network: "website", url: "https://" }] } as Partial<Block>)} className="text-[12px] text-violet-700 hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add</button>}>
          <div className="space-y-2">
            {b.items.map((it, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Select value={it.network} onChange={(network) => set({ items: b.items.map((x, j) => (j === i ? { ...x, network } : x)) } as Partial<Block>)} options={NETWORKS.map((n) => ({ value: n, label: SOCIAL_LABEL[n] }))} width={118} />
                <input value={it.url} onChange={(e) => set({ items: b.items.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) } as Partial<Block>)} className={`${inputCls} flex-1 min-w-0 text-[12px]`} placeholder="https://…" />
                <button type="button" onClick={() => set({ items: b.items.filter((_, j) => j !== i) } as Partial<Block>)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            {brand.social.length > 0 && <button type="button" onClick={() => set({ items: [...brand.social] } as Partial<Block>)} className="text-[12px] text-violet-700 hover:underline">Use the brand library&apos;s links</button>}
          </div>
          <div className="mt-3">
            <Field label="Icon style"><Segment value={b.iconStyle} onChange={(iconStyle) => set({ iconStyle } as Partial<Block>)} options={[{ value: "color", label: "Color" }, { value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} /></Field>
            <Field label="Icon size"><NumberInput value={b.iconSize} onChange={(n) => set({ iconSize: n ?? 32 } as Partial<Block>)} unit="px" min={16} max={64} width={64} /></Field>
            <Field label="Gap"><NumberInput value={b.gap} onChange={(n) => set({ gap: n ?? 12 } as Partial<Block>)} unit="px" max={60} width={64} /></Field>
            <Field label="Alignment"><AlignGroup value={b.align} onChange={(align) => set({ align } as Partial<Block>)} /></Field>
          </div>
        </PanelSection>
      );
    case "html":
      return (
        <PanelSection title="HTML">
          <textarea value={b.html} onChange={(e) => set({ html: e.target.value } as Partial<Block>)} rows={12} className={`${inputCls} w-full h-auto py-2 font-mono text-[12px] resize-y`} spellCheck={false} />
          <p className="text-[11px] text-gray-400 mt-1">Sent exactly as written. Use inline styles; tokens like {"{{firstName}}"} work here too.</p>
        </PanelSection>
      );
    case "navigation":
      return (
        <>
          <PanelSection title="Navigation" right={<button type="button" onClick={() => set({ items: [...b.items, { label: "Link", href: "https://" }] } as Partial<Block>)} className="text-[12px] text-violet-700 hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add</button>}>
            <div className="space-y-2">
              {b.items.map((it, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input value={it.label} onChange={(e) => set({ items: b.items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) } as Partial<Block>)} className={`${inputCls} w-24 text-[12px]`} placeholder="Label" />
                  <input value={it.href} onChange={(e) => set({ items: b.items.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)) } as Partial<Block>)} className={`${inputCls} flex-1 min-w-0 text-[12px]`} placeholder="https://…" />
                  <button type="button" onClick={() => set({ items: b.items.filter((_, j) => j !== i) } as Partial<Block>)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {brand.links.length > 0 && <button type="button" onClick={() => set({ items: [...brand.links] } as Partial<Block>)} className="text-[12px] text-violet-700 hover:underline">Use the brand library&apos;s links</button>}
            </div>
            <div className="mt-3">
              <Field label="Separator"><TextInput value={b.separator} onChange={(separator) => set({ separator } as Partial<Block>)} placeholder="none" width={80} /></Field>
              <Field label="Gap"><NumberInput value={b.gap} onChange={(n) => set({ gap: n ?? 16 } as Partial<Block>)} unit="px" max={80} width={64} /></Field>
              <Field label="Alignment"><AlignGroup value={b.align} onChange={(align) => set({ align } as Partial<Block>)} /></Field>
            </div>
          </PanelSection>
          <TextStyleFields style={b.style} brand={brand} onChange={(style) => set({ style } as Partial<Block>)} inheritHint="Paragraph" />
        </>
      );
    case "video":
      return (
        <>
          <PanelSection title="Video">
            <p className="text-[12px] text-gray-500 mb-2">Email can&apos;t play video. This shows a thumbnail that opens the video link.</p>
            <ImagePicker value={b.thumbnail} onChange={(thumbnail) => set({ thumbnail } as Partial<Block>)} label="Thumbnail" />
            <Field label="Video link"><TextInput value={b.href} onChange={(href) => set({ href } as Partial<Block>)} placeholder="https://youtube.com/…" width={190} /></Field>
            <Field label="Alt text"><TextInput value={b.alt} onChange={(alt) => set({ alt } as Partial<Block>)} width={170} /></Field>
            <Field label="Play button"><Toggle value={b.playButton} onChange={(playButton) => set({ playButton } as Partial<Block>)} /></Field>
          </PanelSection>
          <PanelSection title="Layout">
            <Field label="Width"><NumberInput value={b.width} onChange={(width) => set({ width } as Partial<Block>)} unit="px" max={600} width={64} placeholder="full" /></Field>
            <Field label="Alignment"><AlignGroup value={b.align} onChange={(align) => set({ align } as Partial<Block>)} /></Field>
          </PanelSection>
        </>
      );
    case "product":
      return (
        <>
          <PanelSection title="Product">
            <ImagePicker value={b.image} onChange={(image) => set({ image } as Partial<Block>)} label="Product image" />
            <Field label="Image width"><NumberInput value={b.imageWidth} onChange={(n) => set({ imageWidth: n ?? 240 } as Partial<Block>)} unit="px" min={60} max={600} width={64} /></Field>
            <Field label="Title"><TextInput value={b.title} onChange={(title) => set({ title } as Partial<Block>)} width={190} /></Field>
            <Field label="Price"><TextInput value={b.price} onChange={(price) => set({ price } as Partial<Block>)} width={190} /></Field>
            <div className="py-1.5"><p className="text-[13px] text-gray-700 mb-1">Description</p><textarea value={b.description} onChange={(e) => set({ description: e.target.value } as Partial<Block>)} rows={3} className={`${inputCls} w-full h-auto py-2 resize-y`} /></div>
            <Field label="Button label"><TextInput value={b.buttonLabel} onChange={(buttonLabel) => set({ buttonLabel } as Partial<Block>)} width={190} /></Field>
            <Field label="Button link"><TextInput value={b.buttonHref} onChange={(buttonHref) => set({ buttonHref } as Partial<Block>)} width={190} /></Field>
            <Field label="Alignment"><AlignGroup value={b.align} onChange={(align) => set({ align } as Partial<Block>)} /></Field>
          </PanelSection>
          <TextStyleFields style={b.style} brand={brand} onChange={(style) => set({ style } as Partial<Block>)} inheritHint="Paragraph" />
        </>
      );
  }
}

export { spacing };
