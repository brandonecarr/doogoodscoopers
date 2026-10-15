"use client";

import { Fragment, useState, type CSSProperties, type DragEvent } from "react";
import { ArrowUp, ArrowDown, Copy, Trash2, Move, Eye, EyeOff, Bookmark } from "lucide-react";
import {
  type Design, type Section, type Column, type Block, type Selection, type BrandLibrary, type Box, nodeName,
} from "@/lib/email-designer/model";
import { textCss, linkCss, pad, borderCss, borderDecl, radiusDecl, socialIconUrl, SOCIAL_LABEL, darkCssText, darkClass, marginCss } from "@/lib/email-designer/render";
import { sampleTokens } from "@/lib/sample-tokens";
import { RichText } from "./RichText";

/* The live canvas: the design laid out as it will send, with hover labels, a
   selection toolbar, drop zones while dragging, and inline text editing. */

export type DropTarget = { kind: "block"; columnId: string; index: number } | { kind: "section"; index: number };
export type Device = "desktop" | "mobile";

export interface CanvasProps {
  design: Design;
  brand: BrandLibrary;
  selection: Selection;
  device: Device;
  previewing: boolean;
  /** Show the email's dark-mode colors (only when the design has dark mode on). */
  dark?: boolean;
  dragging: boolean;
  onSaveSection?: (id: string) => void;
  onSelect: (s: Selection) => void;
  onChangeBlock: (id: string, patch: Partial<Block>) => void;
  onDrop: (e: DragEvent, target: DropTarget) => void;
  onDragStart: (e: DragEvent, payload: { move: "block" | "section"; id: string }) => void;
  onDragEnd: () => void;
  onDuplicate: (s: Selection) => void;
  onDelete: (s: Selection) => void;
  onMove: (s: Selection, dir: -1 | 1) => void;
}

/** kebab-case CSS record → React style object. */
export function toStyle(decl: Record<string, string | number | null | undefined>): CSSProperties {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(decl)) {
    if (v === null || v === undefined || v === "") continue;
    if (k.startsWith("mso-")) continue;
    out[k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
  }
  return out as CSSProperties;
}

const boxStyle = (b: Box): CSSProperties => toStyle({
  padding: pad(b.padding),
  "background-color": b.background || undefined,
  ...radiusDecl(b.radius, b.radiusCorners),
  ...borderDecl(b.border),
});

function hiddenOn(b: Box, device: Device): boolean {
  return (b.visibility === "desktop" && device === "mobile") || (b.visibility === "mobile" && device === "desktop");
}

export function Canvas(p: CanvasProps) {
  const { design, selection, device, previewing } = p;
  const s = design.styles;
  const width = device === "mobile" ? 390 : s.bodyWidth;
  const [hover, setHover] = useState<Selection>(null);
  const sel = (kind: "section" | "column" | "block", id: string) => selection?.kind === kind && selection.id === id;

  const zone = (target: DropTarget, key: string, horizontal = false) => p.dragging ? (
    <div key={key}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; (e.currentTarget as HTMLElement).classList.add("dgs-zone-hot"); }}
      onDragLeave={(e) => (e.currentTarget as HTMLElement).classList.remove("dgs-zone-hot")}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLElement).classList.remove("dgs-zone-hot"); p.onDrop(e, target); }}
      className={`dgs-zone ${horizontal ? "dgs-zone-row" : ""}`}
    />
  ) : null;

  const label = (node: Section | Column | Block, kind: "section" | "column" | "block") => {
    const show = !previewing && (hover?.kind === kind && hover.id === node.id || sel(kind, node.id));
    if (!show) return null;
    return <span className={`dgs-label ${sel(kind, node.id) ? "dgs-label-sel" : ""}`}>{nodeName(node)}</span>;
  };

  const toolbar = (node: Section | Column | Block, kind: "section" | "column" | "block") => {
    if (previewing || !sel(kind, node.id) || kind === "column") return null;
    const selection: Selection = { kind, id: node.id };
    return (
      <div className="dgs-toolbar" onMouseDown={(e) => e.stopPropagation()}>
        <span draggable onDragStart={(e) => p.onDragStart(e, { move: kind, id: node.id })} onDragEnd={p.onDragEnd} title="Drag to move" className="dgs-tb cursor-grab active:cursor-grabbing"><Move className="w-3.5 h-3.5" /></span>
        <button type="button" title="Move up" onClick={() => p.onMove(selection, -1)} className="dgs-tb"><ArrowUp className="w-3.5 h-3.5" /></button>
        <button type="button" title="Move down" onClick={() => p.onMove(selection, 1)} className="dgs-tb"><ArrowDown className="w-3.5 h-3.5" /></button>
        <button type="button" title="Duplicate" onClick={() => p.onDuplicate(selection)} className="dgs-tb"><Copy className="w-3.5 h-3.5" /></button>
        {kind === "section" && p.onSaveSection && <button type="button" title="Save to library" onClick={() => p.onSaveSection!(node.id)} className="dgs-tb"><Bookmark className="w-3.5 h-3.5" /></button>}
        <button type="button" title="Delete" onClick={() => p.onDelete(selection)} className="dgs-tb dgs-tb-danger"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    );
  };

  const renderBlock = (block: Block): React.ReactNode => {
    switch (block.type) {
      case "title": {
        const style = toStyle(textCss(s, block, block.style, block.align));
        return previewing
          ? <div style={style} dangerouslySetInnerHTML={{ __html: sampleTokens(block.html) }} />
          : <RichText html={block.html} style={style} tag={`h${block.level}` as "h1"} onChange={(html) => p.onChangeBlock(block.id, { html } as Partial<Block>)} />;
      }
      case "text": {
        const style = toStyle(textCss(s, block, block.style, block.align));
        return previewing
          ? <div style={style} dangerouslySetInnerHTML={{ __html: sampleTokens(block.html) }} />
          : <RichText html={block.html} style={style} onChange={(html) => p.onChangeBlock(block.id, { html } as Partial<Block>)} />;
      }
      case "dynamic": {
        const style = toStyle(textCss(s, block, block.style, block.align));
        const value = previewing ? sampleTokens(`{{${block.token}}}`) : `{{${block.token}}}`;
        return <div style={style}>{block.prefix}<span className={previewing ? "" : "dgs-token"}>{value}</span>{block.suffix}</div>;
      }
      case "image":
      case "logo": {
        const w = block.type === "logo" ? `${block.width}px` : block.width ? `${block.width}${block.widthUnit}` : "100%";
        if (!block.src) return <div className="dgs-placeholder">{block.type === "logo" ? "Logo: pick an image in the panel" : "Image: pick an image in the panel"}</div>;
        return <div style={{ textAlign: block.align }}><img src={block.src} alt={block.alt} style={{ width: w, maxWidth: "100%", height: "auto", display: "inline-block", borderRadius: block.type === "image" ? block.imageRadius : 0 }} /></div>;
      }
      case "video": {
        if (!block.thumbnail) return <div className="dgs-placeholder">Video: pick a thumbnail in the panel</div>;
        return (
          <div style={{ textAlign: block.align }}>
            <span style={{ position: "relative", display: "inline-block", width: block.width ? block.width : "100%", maxWidth: "100%" }}>
              <img src={block.thumbnail} alt={block.alt} style={{ width: "100%", display: "block", borderRadius: 8 }} />
              {block.playButton && <span style={{ position: "absolute", left: "50%", top: "50%", width: 64, height: 64, marginLeft: -32, marginTop: -32, borderRadius: 32, background: "rgba(11,27,43,.75)" }}><span style={{ display: "block", width: 0, height: 0, borderLeft: "22px solid #fff", borderTop: "13px solid transparent", borderBottom: "13px solid transparent", margin: "19px 0 0 24px" }} /></span>}
            </span>
          </div>
        );
      }
      case "button": {
        const b = s.button; const st = block.style;
        const width = block.width ? `${block.width}${block.widthUnit}` : b.width ? `${b.width}px` : undefined;
        return (
          <div style={{ textAlign: block.align }}>
            <span style={{
              display: "inline-block", boxSizing: "border-box", width, maxWidth: "100%", padding: pad(block.inner), fontFamily: st.font || b.font, fontSize: st.size ?? b.size,
              fontWeight: (st.bold ?? b.bold) ? "bold" : "normal", color: st.color || b.color, background: block.buttonBg || b.bg, borderRadius: block.buttonRadius ?? b.radius,
              border: block.buttonBorder ? borderCss(block.buttonBorder) || undefined : b.borderSize ? `${b.borderSize}px solid ${b.borderColor}` : undefined, textAlign: "center", lineHeight: 1.2,
            }}>{block.label || "Button"}</span>
          </div>
        );
      }
      case "divider":
        return <div style={{ textAlign: block.align }}><div style={{ display: "inline-block", width: `${block.width}%`, borderTop: `${block.thickness}px ${block.lineStyle} ${block.color}` }} /></div>;
      case "spacer":
        return <div style={{ height: block.height }} className={previewing ? "" : "dgs-spacer"} />;
      case "social":
        return (
          <div style={{ textAlign: block.align, display: "flex", justifyContent: block.align === "center" ? "center" : block.align === "right" ? "flex-end" : "flex-start", gap: block.gap }}>
            {block.items.map((it, i) => <img key={i} src={socialIconUrl(it.network, block.iconStyle)} alt={SOCIAL_LABEL[it.network]} title={it.url} width={block.iconSize} height={block.iconSize} style={{ display: "block" }} />)}
            {!block.items.length && <span className="dgs-placeholder">Add social links in the panel</span>}
          </div>
        );
      case "navigation": {
        const style = toStyle(textCss(s, block, block.style, block.align));
        const l = toStyle(linkCss(s));
        return <div style={style}>{block.items.map((it, i) => <Fragment key={i}>{i > 0 && block.separator && <span style={{ padding: `0 ${block.gap / 2}px` }}>{block.separator}</span>}<span style={{ ...l, padding: `0 ${block.gap / 2}px`, display: "inline-block" }}>{it.label}</span></Fragment>)}</div>;
      }
      case "product": {
        const style = toStyle(textCss(s, block, block.style, block.align)); const b = s.button;
        return (
          <div style={{ textAlign: block.align }}>
            {block.image ? <img src={block.image} alt={block.title} style={{ width: block.imageWidth, maxWidth: "100%", borderRadius: 8 }} /> : <div className="dgs-placeholder">Product image</div>}
            <div style={{ ...style, fontWeight: "bold", marginTop: 12 }}>{block.title}</div>
            <div style={{ ...style, color: s.link.color, fontWeight: "bold" }}>{block.price}</div>
            <div style={{ ...style, marginTop: 6 }}>{block.description}</div>
            {block.buttonLabel && <span style={{ display: "inline-block", marginTop: 12, padding: pad(b.inner), fontFamily: b.font, fontSize: b.size, fontWeight: b.bold ? "bold" : "normal", color: b.color, background: b.bg, borderRadius: b.radius }}>{block.buttonLabel}</span>}
          </div>
        );
      }
      case "html":
        return <div dangerouslySetInnerHTML={{ __html: previewing ? sampleTokens(block.html) : block.html }} />;
    }
  };

  const blockEl = (block: Block, column: Column, index: number) => {
    const hidden = hiddenOn(block, device);
    if (hidden && previewing) return null;
    return (
      <Fragment key={block.id}>
        {zone({ kind: "block", columnId: column.id, index }, `z-${column.id}-${index}`)}
        <div
          className={`dgs-node dgs-block ${sel("block", block.id) ? "dgs-selected" : ""} ${hidden ? "dgs-hidden-on-device" : ""}`}
          style={toStyle(marginCss(block))}
          onMouseEnter={() => setHover({ kind: "block", id: block.id })}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => { e.stopPropagation(); p.onSelect({ kind: "block", id: block.id }); }}
        >
          {label(block, "block")}
          {toolbar(block, "block")}
          <div className={`dgs-box ${block.type === "title" || block.type === "text" || block.type === "dynamic" ? "dgs-t" : ""} ${darkClass(block)}`} style={boxStyle(block)}>{renderBlock(block)}</div>
          {block.condition && !previewing && <span className="dgs-cond">{block.condition.when === "present" ? "if" : "unless"} {`{{${block.condition.token}}}`}</span>}
        </div>
      </Fragment>
    );
  };

  const columnEl = (column: Column, section: Section, i: number) => {
    const hidden = hiddenOn(column, device);
    if (hidden && previewing) return null;
    const stacked = device === "mobile" && section.stackOnMobile;
    const gap = section.columnGap;
    return (
      <div
        key={column.id}
        className={`dgs-node dgs-column ${sel("column", column.id) ? "dgs-selected" : ""} ${hidden ? "dgs-hidden-on-device" : ""}`}
        style={{
          width: stacked ? "100%" : `${column.width}%`, flex: stacked ? undefined : `0 0 ${column.width}%`, boxSizing: "border-box",
          paddingLeft: stacked || i === 0 ? 0 : gap / 2, paddingRight: stacked || i === section.columns.length - 1 ? 0 : gap / 2,
          display: "flex", flexDirection: "column", justifyContent: column.vAlign === "middle" ? "center" : column.vAlign === "bottom" ? "flex-end" : "flex-start",
          ...toStyle({ ...marginCss(column), padding: undefined, margin: pad(column.margin) }),
        }}
        onMouseEnter={() => setHover({ kind: "column", id: column.id })}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => { e.stopPropagation(); p.onSelect({ kind: "column", id: column.id }); }}
      >
        {label(column, "column")}
        <div className={`dgs-box ${darkClass(column)}`} style={{ ...boxStyle(column), flex: 1, minHeight: column.blocks.length ? undefined : 48 }}>
          {column.blocks.map((b, bi) => blockEl(b, column, bi))}
          {zone({ kind: "block", columnId: column.id, index: column.blocks.length }, `z-${column.id}-end`)}
          {!column.blocks.length && !p.dragging && <div className="dgs-empty">Drop a block here</div>}
        </div>
      </div>
    );
  };

  const sectionEl = (section: Section, si: number) => {
    const hidden = hiddenOn(section, device);
    if (hidden && previewing) return null;
    const stacked = device === "mobile" && section.stackOnMobile;
    return (
      <Fragment key={section.id}>
        {zone({ kind: "section", index: si }, `zs-${si}`)}
        <div
          className={`dgs-node dgs-section ${sel("section", section.id) ? "dgs-selected" : ""} ${hidden ? "dgs-hidden-on-device" : ""}`}
          style={toStyle(marginCss(section))}
          onMouseEnter={() => setHover({ kind: "section", id: section.id })}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => { e.stopPropagation(); p.onSelect({ kind: "section", id: section.id }); }}
        >
          {label(section, "section")}
          {toolbar(section, "section")}
          <div className={`dgs-box ${section.background ? "dgs-sec" : ""} ${darkClass(section)}`} style={boxStyle(section)}>
            <div style={{ display: "flex", flexDirection: stacked ? "column" : "row", alignItems: section.vAlign === "middle" ? "center" : section.vAlign === "bottom" ? "flex-end" : "stretch", gap: stacked ? section.stackGap || 0 : 0 }}>
              {section.columns.map((c, i) => columnEl(c, section, i))}
            </div>
          </div>
          {section.condition && !previewing && <span className="dgs-cond">{section.condition.when === "present" ? "if" : "unless"} {`{{${section.condition.token}}}`}</span>}
        </div>
      </Fragment>
    );
  };

  return (
    <div className={`dgs-canvas dgs-page ${previewing ? "dgs-previewing" : ""} ${p.dark ? "dgs-dark" : ""}`} style={{ background: s.pageBg }} onClick={() => p.onSelect(null)}>
      <style>{CANVAS_CSS}{p.dark ? darkCssText(design, ".dgs-canvas.dgs-dark ") : ""}</style>
      <div style={{ padding: pad(s.bodyPadding), paddingTop: Math.max(s.bodyPadding.top, 44) }}>
        {s.viewInBrowser && <div style={{ textAlign: "center", padding: "12px 0 0", fontFamily: s.text.paragraph.font, fontSize: 12, color: s.text.paragraph.color, textDecoration: "underline" }}>View in browser</div>}
        <div className="dgs-body" style={{ width, maxWidth: "100%", margin: "0 auto", background: s.bodyBg, borderRadius: s.bodyRadius, minHeight: 200 }}>
          {design.sections.map(sectionEl)}
          {zone({ kind: "section", index: design.sections.length }, "zs-end")}
          {!design.sections.length && !p.dragging && (
            <div className="dgs-empty" style={{ margin: 24, padding: 40 }}>Your email is empty. Drag a section or a block in from the left.</div>
          )}
        </div>
      </div>
      <div className="dgs-device-note">{previewing ? <><Eye className="w-3.5 h-3.5" /> Preview with sample values</> : <><EyeOff className="w-3.5 h-3.5" /> Editing · {device === "mobile" ? "mobile" : "desktop"} view</>}{p.dark ? " · dark mode" : ""}</div>
    </div>
  );
}

const CANVAS_CSS = `
.dgs-canvas{position:relative;min-height:100%;padding-bottom:48px;}
.dgs-node{position:relative;}
/* Hover and selection frames sit on the element itself (the .dgs-box carries its radius), so they follow rounded corners. */
.dgs-canvas:not(.dgs-previewing) .dgs-node:hover > .dgs-box{outline:1px dashed #a78bfa;outline-offset:-1px;}
.dgs-canvas:not(.dgs-previewing) .dgs-node.dgs-selected > .dgs-box{outline:2px solid #7c3aed;outline-offset:-2px;}
.dgs-canvas:not(.dgs-previewing) .dgs-node.dgs-selected{z-index:2;}
.dgs-canvas:not(.dgs-previewing) .dgs-section.dgs-selected{z-index:1;}
.dgs-label{position:absolute;top:-1px;left:0;transform:translateY(-100%);z-index:5;background:#ede9fe;color:#5b21b6;border:1px solid #c4b5fd;border-radius:6px 6px 0 0;padding:1px 8px;font:600 11px/16px ui-sans-serif,system-ui,sans-serif;pointer-events:none;white-space:nowrap;}
.dgs-label-sel{background:#7c3aed;color:#fff;border-color:#7c3aed;}
.dgs-section > .dgs-label{left:auto;right:0;}
.dgs-toolbar{position:absolute;bottom:-14px;left:50%;transform:translate(-50%,100%);z-index:6;display:flex;gap:2px;padding:4px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 6px 20px rgba(15,23,42,.15);}
.dgs-section > .dgs-toolbar{bottom:auto;top:-14px;transform:translate(-50%,-100%);}
.dgs-tb{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:7px;color:#1f2937;background:#fff;border:0;cursor:pointer;}
.dgs-tb:hover{background:#f3f4f6;}
.dgs-tb-danger:hover{background:#fee2e2;color:#b91c1c;}
.dgs-zone{height:6px;margin:2px 0;border-radius:4px;background:#ddd6fe;transition:height .1s,background .1s;}
.dgs-zone-hot{height:28px;background:#8b5cf6;}
.dgs-empty{border:1px dashed #cbd5e1;border-radius:10px;padding:16px;text-align:center;color:#94a3b8;font:13px ui-sans-serif,system-ui,sans-serif;}
.dgs-placeholder{border:1px dashed #cbd5e1;border-radius:8px;padding:28px 12px;text-align:center;color:#94a3b8;font:13px ui-sans-serif,system-ui,sans-serif;}
.dgs-spacer{background:repeating-linear-gradient(135deg,transparent 0 6px,#eef2ff 6px 12px);}
.dgs-hidden-on-device{opacity:.35;}
.dgs-token{background:#ede9fe;color:#5b21b6;border-radius:4px;padding:0 4px;font-family:ui-monospace,monospace;font-size:.9em;}
.dgs-cond{position:absolute;right:6px;top:6px;z-index:4;background:#fef3c7;color:#92400e;border-radius:6px;padding:1px 6px;font:600 10px/16px ui-sans-serif,system-ui,sans-serif;}
.dgs-device-note{position:absolute;left:12px;bottom:12px;display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #e5e7eb;border-radius:999px;padding:4px 10px;font:12px ui-sans-serif,system-ui,sans-serif;color:#6b7280;}
`;
