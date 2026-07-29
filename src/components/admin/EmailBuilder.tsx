"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import grapesjs, { type Editor } from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import presetNewsletter from "grapesjs-preset-newsletter";
import {
  AlignCenter, AlignLeft, AlignRight, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart, Check, ChevronDown, Copy, Eye, ImagePlus, Layers,
  Info, LayoutGrid, Loader2, Monitor, MousePointerClick, Palette, Redo2, Settings2, Smartphone,
  Sliders, Trash2, Undo2, X,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Email-wide settings — the "body" controls Brevo puts above everything
 * else. Held in React (not GrapesJS) so they can drive both the canvas
 * preview and the exported email scaffold.
 * ------------------------------------------------------------------ */

export interface EmailSettings {
  pageBg: string;
  pageBgImage: string;
  pageBgFit: "cover" | "contain" | "tile" | "actual";
  pageBgPosition: string;
  /** 0 = image invisible, 1 = fully visible. */
  pageBgOpacity: number;
  contentBg: string;
  contentWidth: number;
  outerPadding: number;
  font: string;
  textColor: string;
  linkColor: string;
}

/** New designs get the classic newsletter look. */
const NEW_DESIGN: EmailSettings = {
  pageBg: "#f1f5f9",
  pageBgImage: "",
  pageBgFit: "cover",
  pageBgPosition: "center center",
  pageBgOpacity: 1,
  contentBg: "#ffffff",
  contentWidth: 600,
  outerPadding: 24,
  font: "Arial, Helvetica, sans-serif",
  textColor: "#1f2937",
  linkColor: "#0d9488",
};

/** Designs saved before these controls existed: change nothing they didn't ask for. */
const EXISTING_DESIGN: EmailSettings = {
  ...NEW_DESIGN,
  pageBg: "",
  contentBg: "",
  outerPadding: 0,
  font: "",
  textColor: "",
  linkColor: "",
};

const FONTS = [
  { value: "", label: "Inherit" },
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "Helvetica, Arial, sans-serif", label: "Helvetica" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
  { value: "Tahoma, Verdana, sans-serif", label: "Tahoma" },
  { value: "'Trebuchet MS', Helvetica, sans-serif", label: "Trebuchet MS" },
  { value: "Georgia, 'Times New Roman', serif", label: "Georgia" },
  { value: "'Times New Roman', Times, serif", label: "Times New Roman" },
  { value: "'Courier New', Courier, monospace", label: "Courier New" },
];

const PAGE_SWATCHES = ["#ffffff", "#f1f5f9", "#e2e8f0", "#f0fdfa", "#fff7ed", "#fdf2f8", "#134e4a", "#0d1b2a"];
const CONTENT_SWATCHES = ["#ffffff", "#fafafa", "#f8fafc", "#f0fdfa", "#fffbeb", "#0d1b2a"];

/** How the four fit presets map to real CSS. */
const FIT: Record<EmailSettings["pageBgFit"], { size: string; repeat: string }> = {
  cover: { size: "cover", repeat: "no-repeat" },
  contain: { size: "contain", repeat: "no-repeat" },
  tile: { size: "auto", repeat: "repeat" },
  actual: { size: "auto", repeat: "no-repeat" },
};

const POSITIONS = [
  ["left top", "center top", "right top"],
  ["left center", "center center", "right center"],
  ["left bottom", "center bottom", "right bottom"],
];

const HEX = /^#[0-9a-f]{3,8}$/i;
const safeColor = (c: string) => (c && HEX.test(c) ? c : "");

/**
 * CSS has no opacity for a background image, so we lay a translucent sheet of
 * the page colour over it. alpha here is the sheet's opacity — the inverse of
 * how visible the image should be.
 */
function rgba(hex: string, alpha: number) {
  let h = (hex || "#ffffff").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return `rgba(255,255,255,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 1));

/** Anything you can see through: unset, `transparent`, or an rgba with 0 alpha. */
const isSeeThrough = (v?: string) =>
  !v || /^\s*transparent\s*$/i.test(v) || /rgba\([^)]*,\s*0(\.0+)?\s*\)/i.test(v);
const safeUrl = (u: string) => (/^https?:\/\/\S+$/i.test(u.trim()) ? u.trim() : "");
const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ------------------------------------------------------------------ *
 * Editor chrome
 * ------------------------------------------------------------------ */

// GrapesJS ships a dark theme and expects Font Awesome for its icons. We load
// neither, so this repaints its managers to match the admin UI and turns the
// icon-only radio groups — alignment among them — into readable segmented
// controls instead of blank squares.
const THEME_CSS = `
.gjs-editor-cont .gjs-pn-panels { display:none !important; }
.gjs-editor-cont .gjs-cv-canvas {
  top:0 !important; width:100% !important; height:100% !important;
  background:#eceff3;
}
.gjs-frame { box-shadow:0 12px 32px rgba(15,23,42,.10), 0 2px 6px rgba(15,23,42,.05); background:#fff; }

.gjs-one-bg { background-color:#ffffff; }
.gjs-two-color { color:#0f172a; }
.gjs-three-bg { background-color:#14b8a6; color:#fff; }
.gjs-four-color, .gjs-four-color-h:hover { color:#14b8a6; }

/* Selection affordances */
.gjs-badge { background-color:#0f172a; border-radius:5px; font-size:10px; font-weight:600; letter-spacing:.02em; padding:2px 6px; }
.gjs-toolbar { background-color:#14b8a6; border-radius:6px; overflow:hidden; }
.gjs-toolbar-item { padding:4px 5px; }
.gjs-dashed *[data-gjs-highlightable] { outline:1px dashed rgba(148,163,184,.55); outline-offset:-1px; }

/* Blocks */
.gjs-blocks-c { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; padding:12px; }
.gjs-block {
  width:auto; min-height:0; margin:0; padding:12px 6px 10px;
  display:flex; flex-direction:column; align-items:center; justify-content:flex-start; gap:7px;
  font-size:10.5px; font-weight:500; line-height:1.25; text-align:center;
  background:#fff; border:1px solid #e8edf3; border-radius:10px; color:#64748b;
  box-shadow:0 1px 2px rgba(15,23,42,.04); transition:transform .15s ease, box-shadow .15s ease, border-color .15s ease, color .15s ease;
  cursor:grab;
}
.gjs-block:hover {
  border-color:#5eead4; color:#0f766e;
  box-shadow:0 6px 16px rgba(20,184,166,.16); transform:translateY(-1px);
}
.gjs-block__media {
  display:flex; align-items:center; justify-content:center;
  width:34px; height:34px; border-radius:9px; background:#f1f5f9; color:#334155; transition:background .15s ease, color .15s ease;
}
.gjs-block:hover .gjs-block__media { background:#ccfbf1; color:#0f766e; }
.gjs-block__media svg { width:20px; height:20px; }
.gjs-block-category .gjs-title { background:#fff; color:#94a3b8; font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; border:0; padding:10px 14px 2px; }

/* Style manager */
.gjs-sm-sector { border-bottom:1px solid #f1f5f9; }
.gjs-sm-sector-title {
  background:#fff; color:#94a3b8; border:0;
  font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase;
  padding:13px 14px 7px;
}
.gjs-sm-sector .gjs-sm-properties { padding:0 14px 14px; }
.gjs-sm-property { margin-bottom:10px; }
.gjs-sm-label, .gjs-label, .gjs-trt-trait__label, .gjs-clm-tags-label {
  color:#64748b; font-size:11px; font-weight:500;
}
.gjs-field {
  background:#fff; border:1px solid #e2e8f0; border-radius:8px; color:#0f172a;
  box-shadow:0 1px 2px rgba(15,23,42,.03);
  transition:border-color .15s ease, box-shadow .15s ease;
}
.gjs-field:focus-within { border-color:#14b8a6; box-shadow:0 0 0 3px rgba(20,184,166,.14); }
.gjs-field input, .gjs-field select, .gjs-field textarea { color:#0f172a; font-size:12px; }
.gjs-field-arrow-u { border-bottom-color:#94a3b8; }
.gjs-field-arrow-d { border-top-color:#94a3b8; }
.gjs-sm-composite, .gjs-sm-stack { border-radius:8px; }

/* Radio groups (alignment, decoration) as a real segmented control. */
.gjs-radio-items { display:flex; gap:4px; flex-wrap:wrap; }
.gjs-radio-item { flex:1 1 0; min-width:52px; border:none; }
.gjs-radio-item-label {
  display:block; text-align:center; padding:6px 4px; font-size:11px; font-weight:500; cursor:pointer;
  border:1px solid #e2e8f0; border-radius:7px; color:#475569; transition:all .12s ease;
}
.gjs-radio-item-label:hover { border-color:#5eead4; color:#0f766e; }
.gjs-radio-item input:checked + .gjs-radio-item-label {
  background:#14b8a6; color:#fff; border-color:#14b8a6; box-shadow:0 1px 3px rgba(20,184,166,.35);
}

/* Layers + traits */
.gjs-layer-title { background:#fff; color:#0f172a; }
.gjs-layer-name { font-size:12px; }
.gjs-layer:hover > .gjs-layer-item { background:#f8fafc; }
.gjs-trt-traits { padding:12px 14px; }
.gjs-trt-trait { padding:0 0 10px; }

/* Rich-text toolbar (appears on double-click into text) */
.gjs-rte-toolbar { background:#0f172a; border-radius:8px; box-shadow:0 6px 18px rgba(15,23,42,.28); padding:2px; border:0; }
.gjs-rte-action { color:#e2e8f0; border-right:0; min-width:26px; padding:4px 6px; border-radius:6px; }
.gjs-rte-action:hover { background:rgba(255,255,255,.12); color:#5eead4; }
.gjs-rte-action.gjs-rte-active { background:#14b8a6; color:#fff; }
input.email-rte-color {
  -webkit-appearance:none; appearance:none;
  width:20px; height:16px; padding:0; border:1px solid rgba(255,255,255,.35);
  border-radius:4px; background:none; cursor:pointer; vertical-align:middle;
}
input.email-rte-color::-webkit-color-swatch-wrapper { padding:0; }
input.email-rte-color::-webkit-color-swatch { border:none; border-radius:3px; }

/* Opacity slider */
.email-range { -webkit-appearance:none; appearance:none; width:100%; height:5px; border-radius:999px; outline:none; }
.email-range::-webkit-slider-thumb {
  -webkit-appearance:none; appearance:none; width:15px; height:15px; border-radius:50%;
  background:#14b8a6; border:2.5px solid #fff; box-shadow:0 1px 4px rgba(15,23,42,.28); cursor:pointer;
}
.email-range::-moz-range-thumb {
  width:15px; height:15px; border-radius:50%;
  background:#14b8a6; border:2.5px solid #fff; box-shadow:0 1px 4px rgba(15,23,42,.28); cursor:pointer;
}

/* The colour picker is re-anchored in JS; this keeps it above everything. */
.sp-container { z-index:2147483000 !important; border-radius:10px; border:1px solid #e2e8f0; box-shadow:0 12px 32px rgba(15,23,42,.18); }

/* Scrollbars */
.email-scroll { scrollbar-width:thin; scrollbar-color:#dbe2ea transparent; }
.email-scroll::-webkit-scrollbar { width:9px; height:9px; }
.email-scroll::-webkit-scrollbar-track { background:transparent; }
.email-scroll::-webkit-scrollbar-thumb { background:#dbe2ea; border-radius:9px; border:2px solid #fff; }
.email-scroll::-webkit-scrollbar-thumb:hover { background:#c3cdd9; }
`;

// Style Manager sectors, replacing the preset's. Grouped the way Brevo groups
// them, open by default, with text labels on every radio option.
const SECTORS = [
  {
    id: "text",
    name: "Text",
    open: true,
    buildProps: ["color", "font-size", "font-family", "font-weight", "line-height", "letter-spacing", "text-align", "text-decoration"],
    properties: [
      { property: "color", name: "Text color" },
      { property: "font-family", name: "Font" },
      { property: "font-size", name: "Size" },
      { property: "font-weight", name: "Weight" },
      { property: "line-height", name: "Line height" },
      { property: "letter-spacing", name: "Letter spacing" },
      {
        property: "text-align",
        name: "Alignment",
        type: "radio",
        default: "left",
        options: [
          { id: "left", label: "Left" },
          { id: "center", label: "Center" },
          { id: "right", label: "Right" },
          { id: "justify", label: "Justify" },
        ],
      },
      {
        property: "text-decoration",
        name: "Decoration",
        type: "radio",
        default: "none",
        options: [
          { id: "none", label: "None" },
          { id: "underline", label: "Underline" },
          { id: "line-through", label: "Strike" },
        ],
      },
    ],
  },
  {
    id: "spacing",
    name: "Spacing & size",
    open: true,
    buildProps: ["padding", "margin", "width", "max-width", "height"],
    properties: [
      {
        property: "padding",
        name: "Inner spacing",
        properties: [
          { name: "Top", property: "padding-top" },
          { name: "Right", property: "padding-right" },
          { name: "Bottom", property: "padding-bottom" },
          { name: "Left", property: "padding-left" },
        ],
      },
      {
        property: "margin",
        name: "Outer spacing",
        properties: [
          { name: "Top", property: "margin-top" },
          { name: "Right", property: "margin-right" },
          { name: "Bottom", property: "margin-bottom" },
          { name: "Left", property: "margin-left" },
        ],
      },
    ],
  },
  // Last, so our own Background image control renders directly beneath it.
  {
    id: "background",
    name: "Background & border",
    open: true,
    // No `background` stack property — GrapesJS renders it as an opaque layer
    // chip ("repeat left top cover") with no opacity control at all.
    buildProps: ["background-color", "border-radius", "border"],
    properties: [
      { property: "background-color", name: "Background" },
      {
        property: "border-radius",
        name: "Corner radius",
        properties: [
          { name: "Top left", property: "border-top-left-radius" },
          { name: "Top right", property: "border-top-right-radius" },
          { name: "Bottom right", property: "border-bottom-right-radius" },
          { name: "Bottom left", property: "border-bottom-left-radius" },
        ],
      },
      {
        property: "border",
        name: "Border",
        properties: [
          { name: "Width", property: "border-width", defaults: "0" },
          { name: "Style", property: "border-style" },
          { name: "Color", property: "border-color" },
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Background image — one control, used for the email body and for
 * whichever element is selected.
 * ------------------------------------------------------------------ */

export interface BgImage {
  image: string;
  fit: EmailSettings["pageBgFit"];
  position: string;
  opacity: number;
}

const NO_BG: BgImage = { image: "", fit: "cover", position: "center center", opacity: 1 };

/** Recover our settings back out of a `background-image` declaration. */
function parseBgImage(style: Record<string, string>): BgImage {
  const raw = style["background-image"] || "";
  const veiled = raw.match(
    /^\s*linear-gradient\(\s*rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)\s*,\s*rgba\([^)]*\)\s*\)\s*,\s*([\s\S]*)$/i,
  );
  const rest = veiled ? veiled[2] : raw;
  const url = rest.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i)?.[1] || "";
  // No image yet — hand back the defaults rather than inferring "actual" from
  // the absent background-size.
  if (!url) return NO_BG;
  const size = style["background-size"] || "";
  const repeat = style["background-repeat"] || "";
  return {
    image: url,
    fit: size === "cover" ? "cover" : size === "contain" ? "contain" : repeat === "repeat" ? "tile" : "actual",
    position: style["background-position"] || "center center",
    opacity: veiled ? clamp01(1 - parseFloat(veiled[1])) : 1,
  };
}

/** ...and turn them back into CSS, dimming with a sheet of `veilColor`. */
function bgImageCss(v: BgImage, veilColor: string): Record<string, string> {
  const url = safeUrl(v.image);
  if (!url) return {};
  const fit = FIT[v.fit] || FIT.cover;
  const sheet = 1 - clamp01(v.opacity);
  const veil = sheet > 0 ? `linear-gradient(${rgba(veilColor, sheet)},${rgba(veilColor, sheet)}),` : "";
  return {
    "background-image": `${veil}url("${url}")`,
    "background-size": fit.size,
    "background-repeat": fit.repeat,
    "background-position": v.position,
  };
}

const BG_KEYS = ["background-image", "background-size", "background-repeat", "background-position"];

function BgImageField({
  value,
  onChange,
  veilColor,
  note,
}: {
  value: BgImage;
  onChange: (next: BgImage) => void;
  /** The colour the image is dimmed toward — normally whatever sits behind it. */
  veilColor: string;
  note?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const url = safeUrl(value.image);
  const opacity = clamp01(value.opacity);
  const sheet = 1 - opacity;
  const veil = veilColor || "#ffffff";

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/email-assets", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error || "Upload failed.");
      onChange({ ...value, image: data.url });
    } catch {
      setError("Upload failed — check your connection.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-slate-600">Background image</span>
        {url && (
          <button
            type="button"
            onClick={() => onChange({ ...value, image: "" })}
            className="text-[10px] text-slate-400 hover:text-red-600 transition-colors flex items-center gap-0.5"
          >
            <X className="w-3 h-3" /> Remove
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        onClick={() => !uploading && fileRef.current?.click()}
        className={`relative h-24 rounded-xl border-2 border-dashed overflow-hidden cursor-pointer transition-all flex items-center justify-center ${
          dragOver ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-teal-400 hover:bg-slate-50"
        }`}
        style={url ? {
          // Preview the dimming here too.
          backgroundImage: (sheet > 0 ? `linear-gradient(${rgba(veil, sheet)},${rgba(veil, sheet)}),` : "") + `url("${url}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: veil,
          borderStyle: "solid",
        } : undefined}
      >
        {uploading ? (
          <span className="flex items-center gap-2 text-[11px] text-slate-500 bg-white/90 px-3 py-1.5 rounded-lg">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…
          </span>
        ) : url ? (
          <span className="text-[10.5px] font-medium text-white bg-black/45 px-2.5 py-1 rounded-md backdrop-blur-sm">
            Click to replace
          </span>
        ) : (
          <span className="flex flex-col items-center gap-1 text-slate-400">
            <ImagePlus className="w-5 h-5" />
            <span className="text-[10.5px] font-medium">Upload or drop an image</span>
          </span>
        )}
      </div>

      <input
        type="url"
        value={value.image}
        onChange={(e) => onChange({ ...value, image: e.target.value })}
        placeholder="…or paste an image URL"
        className="mt-2 w-full px-2.5 py-1.5 text-[11px] border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all"
      />
      {error && <p className="mt-1.5 text-[10.5px] text-red-600">{error}</p>}

      {url && (
        <div className="mt-3 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-slate-600">Image opacity</span>
              <span className="text-[10.5px] font-semibold text-teal-700 tabular-nums">{opacity.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0} max={1} step={0.05}
              value={opacity}
              onChange={(e) => onChange({ ...value, opacity: parseFloat(e.target.value) })}
              className="email-range"
              style={{ background: `linear-gradient(90deg,#14b8a6 0%,#14b8a6 ${opacity * 100}%,#e2e8f0 ${opacity * 100}%,#e2e8f0 100%)` }}
            />
            <div className="flex justify-between text-[9.5px] text-slate-400 mt-1">
              <span>0.0 · hidden</span>
              <span>1.0 · full</span>
            </div>
          </div>

          <div>
            <span className="block text-[11px] font-medium text-slate-600 mb-1.5">Fit</span>
            <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
              {(["cover", "contain", "tile", "actual"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onChange({ ...value, fit: f })}
                  className={`flex-1 px-2 py-1.5 text-[11px] font-medium rounded-md capitalize transition-all ${
                    value.fit === f ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-[11px] font-medium text-slate-600 mb-1.5">Position</span>
            <div className="inline-grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
              {POSITIONS.flat().map((p) => (
                <button
                  key={p}
                  type="button"
                  title={p}
                  onClick={() => onChange({ ...value, position: p })}
                  className={`w-6 h-6 rounded-md transition-all ${
                    value.position === p ? "bg-teal-600 shadow-sm" : "bg-white hover:bg-teal-100"
                  }`}
                >
                  <span className={`block w-1.5 h-1.5 rounded-full mx-auto ${value.position === p ? "bg-white" : "bg-slate-300"}`} />
                </button>
              ))}
            </div>
            {note && <p className="mt-1.5 text-[10px] text-slate-400 leading-snug">{note}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tagOf = (c: any) => String(c?.get?.("tagName") || "").toLowerCase();
const isCell = (c: unknown) => tagOf(c) === "td" || tagOf(c) === "th";

/**
 * Vertical alignment in email is `vertical-align` on a table cell — there is no
 * portable equivalent for a plain div. Selecting a Section gives you the table,
 * so reach down to the cells it owns (without descending into nested tables).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cellsOf(sel: any): any[] {
  if (!sel) return [];
  if (isCell(sel)) return [sel];
  const tag = tagOf(sel);
  if (tag !== "table" && tag !== "tbody" && tag !== "tr") return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const found: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (node: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node.components?.()?.forEach?.((child: any) => {
      if (isCell(child)) found.push(child);
      else walk(child);
    });
  };
  walk(sel);
  return found;
}

/** An <img> or <a> is inline — aligning it means aligning the cell it sits in. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function alignTarget(editor: Editor): any {
  const sel = editor.getSelected();
  if (!sel) return null;
  const type = sel.get("type");
  if (type === "image" || type === "link") {
    const parent = sel.parent();
    if (parent && parent.get("type") !== "wrapper") return parent;
  }
  return sel;
}

/** `queryCommandValue('foreColor')` hands back rgb(); <input type=color> wants hex. */
function toHex(value: string) {
  const m = value?.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return HEX.test(value) ? value : "";
  return "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("");
}

/**
 * Colour just the highlighted words. The Style Manager's colour applies to a
 * whole component, so this goes on the rich-text toolbar instead, where a
 * selection actually exists.
 */
function addTextColorAction(editor: Editor) {
  const rte = editor.RichTextEditor;
  if (rte.get("forecolor")) return;
  rte.add("forecolor", {
    icon: '<input type="color" class="email-rte-color" value="#000000" title="Colour the selected text"/>',
    attributes: { title: "Text colour" },
    event: "input",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result: (r: any, action: any) => {
      const input = action.btn?.firstChild as HTMLInputElement | undefined;
      if (!input) return;
      // Without styleWithCSS the browser emits <font color>, which juice can't
      // inline; we want <span style="color:…"> so it survives to the inbox.
      r.doc?.execCommand("styleWithCSS", false, "true");
      r.exec("foreColor", input.value);
      r.doc?.execCommand("styleWithCSS", false, "false");
    },
    // Reflect the colour already under the caret back onto the swatch.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: (r: any, action: any) => {
      const input = action.btn?.firstChild as HTMLInputElement | undefined;
      const current = toHex(String(r.doc?.queryCommandValue("foreColor") || ""));
      if (input && current) input.value = current;
      return 0;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

/** Mirror the email settings into the canvas iframe so the editor is WYSIWYG. */
function paintCanvas(editor: Editor, s: EmailSettings) {
  let doc: Document | null | undefined;
  try { doc = editor.Canvas.getDocument(); } catch { return; }
  if (!doc?.head) return;
  let el = doc.getElementById("gjs-email-settings") as HTMLStyleElement | null;
  if (!el) {
    el = doc.createElement("style");
    el.id = "gjs-email-settings";
    doc.head.appendChild(el);
  }
  const img = safeUrl(s.pageBgImage);
  const fit = FIT[s.pageBgFit] || FIT.cover;
  const veil = clamp01(s.pageBgOpacity) < 1
    ? rgba(safeColor(s.pageBg) || "#ffffff", 1 - clamp01(s.pageBgOpacity))
    : "";
  // GrapesJS styles the wrapper through an #id rule, which outranks a plain
  // `body` selector — hence !important throughout. This is preview-only CSS;
  // the exported email is built separately.
  el.textContent = [
    "body { margin:0 !important;",
    s.pageBg ? `background-color:${s.pageBg} !important;` : "",
    img
      ? `background-image:${veil ? `linear-gradient(${veil},${veil}),` : ""}url("${img}") !important;` +
        `background-size:${fit.size} !important;` +
        `background-repeat:${fit.repeat} !important;background-position:${s.pageBgPosition} !important;`
      : "",
    s.outerPadding ? `padding:${s.outerPadding}px 0 !important;` : "",
    s.font ? `font-family:${s.font} !important;` : "",
    s.textColor ? `color:${s.textColor} !important;` : "",
    "}",
    // Deliberately not !important — GrapesJS styles each element through an
    // #id rule, so an element's own background must be able to win here.
    "body > * { margin-left:auto; margin-right:auto;",
    s.contentWidth ? `max-width:${s.contentWidth}px;` : "",
    s.contentBg ? `background-color:${s.contentBg};` : "",
    "}",
    s.linkColor ? `a { color:${s.linkColor} !important; }` : "",
  ].join("");
}

/** Email clients ignore <style>; push the link colour onto each anchor. */
function inlineLinkColor(html: string, color: string) {
  if (!color) return html;
  return html.replace(/<a\b([^>]*)>/gi, (whole, attrs: string) => {
    if (/color\s*:/i.test(attrs)) return whole;
    if (/style\s*=\s*"/i.test(attrs)) {
      return `<a${attrs.replace(/style\s*=\s*"([^"]*)"/i, (_m, st: string) => `style="${st.replace(/;\s*$/, "")};color:${color}"`)}>`;
    }
    return `<a${attrs} style="color:${color}">`;
  });
}

/**
 * Re-importing our own export would nest the scaffold one level deeper every
 * round trip. Strip it back to the content when we see our marker.
 */
function unwrapScaffold(html: string) {
  if (!html.includes("data-email-content")) return html;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const inner = doc.querySelector("[data-email-content]");
    return inner ? inner.innerHTML : html;
  } catch {
    return html;
  }
}

export interface EmailBuilderHandle {
  getHtml: () => string;
  getDesign: () => object;
}

interface Props {
  initialHtml?: string;
  initialDesign?: object | null;
  /** Receives an accessor so the parent's Save button can pull html + design. */
  onReady?: (handle: EmailBuilderHandle) => void;
}

type Tab = "design" | "settings" | "layers";

export default function EmailBuilder({ initialHtml, initialDesign, onReady }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const blocksRef = useRef<HTMLDivElement>(null);
  const stylesRef = useRef<HTMLDivElement>(null);
  const traitsRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const editorRef = useRef<Editor | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saved = (initialDesign as any)?.emailSettings as Partial<EmailSettings> | undefined;
  const [settings, setSettings] = useState<EmailSettings>(() => ({
    ...(initialDesign && Object.keys(initialDesign).length ? EXISTING_DESIGN : NEW_DESIGN),
    ...(saved || {}),
  }));
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [selection, setSelection] = useState<string | null>(null);
  const [align, setAlign] = useState("");
  const [vAlign, setVAlign] = useState("");
  /** Whether the selection owns table cells, the only thing vertical align works on. */
  const [canVAlign, setCanVAlign] = useState(false);
  /** Background image of whatever is selected, mirrored out of its CSS. */
  const [selBg, setSelBg] = useState<BgImage>(NO_BG);
  const [selVeil, setSelVeil] = useState("#ffffff");
  /**
   * A see-through element still shows nothing if something opaque sits between
   * it and the body image. Name that thing rather than leaving people to guess.
   */
  const [blocker, setBlocker] = useState<{ kind: "content" | "component"; name: string } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blockerComp = useRef<any>(null);
  const [tab, setTab] = useState<Tab>("design");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewing, setPreviewing] = useState(false);
  const [emailOpen, setEmailOpen] = useState(true);

  const set = useCallback(<K extends keyof EmailSettings>(key: K, value: EmailSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const applyAlign = useCallback((value: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const target = alignTarget(editor);
    if (!target) return;
    target.addStyle({ "text-align": value });
    // Outlook's Word engine honours the attribute more reliably than the style.
    if (isCell(target)) target.addAttributes({ align: value });
    // An image only obeys its cell's text-align while it stays inline.
    const sel = editor.getSelected();
    if (sel?.get("type") === "image") sel.addStyle({ display: "inline-block", float: "none" });
    setAlign(value);
  }, []);

  /** Vertical alignment lands on the cells the selection owns. */
  const applyVAlign = useCallback((value: string) => {
    const sel = editorRef.current?.getSelected();
    const cells = cellsOf(sel);
    if (!cells.length) return;
    for (const cell of cells) {
      cell.addStyle({ "vertical-align": value });
      cell.addAttributes({ valign: value });
    }
    setVAlign(value);
  }, []);

  /** Write a background image back onto the selected element. */
  const applySelBg = useCallback((next: BgImage, veil: string) => {
    setSelBg(next);
    const sel = editorRef.current?.getSelected();
    if (!sel) return;
    const style = { ...((sel.getStyle() || {}) as Record<string, string>) };
    for (const k of BG_KEYS) delete style[k];
    sel.setStyle({ ...style, ...bgImageCss(next, veil) });
  }, []);

  /** Clear whichever opaque layer is hiding the body image. */
  const clearBlocker = useCallback(() => {
    if (blocker?.kind === "content") {
      setSettings((prev) => ({ ...prev, contentBg: "" }));
    } else if (blockerComp.current) {
      const style = { ...((blockerComp.current.getStyle() || {}) as Record<string, string>) };
      delete style["background-color"];
      blockerComp.current.setStyle(style);
    }
    setBlocker(null);
  }, [blocker]);

  const run = useCallback((cmd: string) => editorRef.current?.runCommand(cmd), []);

  const switchDevice = useCallback((next: "desktop" | "mobile") => {
    setDevice(next);
    editorRef.current?.setDevice(next === "mobile" ? "Mobile portrait" : "Desktop");
  }, []);

  const togglePreview = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = !previewing;
    if (next) editor.runCommand("preview");
    else editor.stopCommand("preview");
    setPreviewing(next);
  }, [previewing]);

  /* -------------------------------------------------------------- */

  useEffect(() => {
    if (!canvasRef.current || editorRef.current) return;

    const editor = grapesjs.init({
      container: canvasRef.current,
      height: "100%",
      fromElement: false,
      storageManager: false,
      assetManager: { embedAsBase64: true },
      // Style the element you clicked, not everything sharing its class.
      selectorManager: { componentFirst: true },
      blockManager: { appendTo: blocksRef.current! },
      styleManager: { appendTo: stylesRef.current!, sectors: SECTORS },
      traitManager: { appendTo: traitsRef.current! },
      layerManager: { appendTo: layersRef.current! },
      plugins: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ed: Editor) => (presetNewsletter as any)(ed, {
          modalTitleImport: "Import email HTML",
          inlineCss: true,
          // We own the chrome now — don't let the preset re-theme or re-sector it.
          updateStyleManager: false,
          showStylesOnChange: false,
          showBlocksOnLoad: false,
          useCustomTheme: false,
        }),
      ],
    });
    editorRef.current = editor;

    const syncSelection = () => {
      const sel = editor.getSelected();
      if (!sel) {
        setSelection(null);
        setAlign("");
        setVAlign("");
        setCanVAlign(false);
        setSelBg(NO_BG);
        return;
      }
      setSelection(sel.getName?.() || String(sel.get("type") || "Element"));
      setAlign(((alignTarget(editor)?.getStyle() || {}) as Record<string, string>)["text-align"] || "");
      const cells = cellsOf(sel);
      setCanVAlign(cells.length > 0);
      setVAlign(cells.length ? ((cells[0].getStyle() || {}) as Record<string, string>)["vertical-align"] || "" : "");
      const own = (sel.getStyle() || {}) as Record<string, string>;
      setSelBg(parseBgImage(own));
      setSelVeil(safeColor(own["background-color"] || "") || "#ffffff");

      // Walk up looking for the first opaque layer between this element and the
      // body — only worth reporting when the element itself is see-through and
      // there is actually a body image to reveal.
      blockerComp.current = null;
      const s = settingsRef.current;
      if (!safeUrl(s.pageBgImage) || !isSeeThrough(own["background-color"])) {
        setBlocker(null);
        return;
      }
      let node = sel.parent();
      let found: { kind: "content" | "component"; name: string } | null = null;
      while (node) {
        if (node.get("type") === "wrapper") {
          if (!isSeeThrough(s.contentBg)) found = { kind: "content", name: "Content background" };
          break;
        }
        const bg = ((node.getStyle() || {}) as Record<string, string>)["background-color"];
        if (!isSeeThrough(bg)) {
          blockerComp.current = node;
          found = { kind: "component", name: node.getName?.() || "Container" };
          break;
        }
        node = node.parent();
      }
      setBlocker(found);
    };
    editor.on("component:selected", syncSelection);
    editor.on("component:deselected", syncSelection);
    // Keep in step when the Style Manager edits background-color underneath us.
    editor.on("component:styleUpdate", syncSelection);

    // Load existing design (preferred) or seed HTML.
    try {
      if (initialDesign && Object.keys(initialDesign).length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (editor as any).loadProjectData(initialDesign);
      } else if (initialHtml) {
        editor.setComponents(unwrapScaffold(initialHtml));
      }
    } catch { /* fall back to empty canvas */ }

    editor.onReady(() => {
      addTextColorAction(editor);
      paintCanvas(editor, settingsRef.current);
      // The preset hides component outlines by default, which makes empty
      // cells impossible to find. Turn them on.
      editor.runCommand("core:component-outline");
    });

    onReady?.({
      getHtml: () => {
        // preset-newsletter registers this command → returns email-safe inlined HTML
        const inlined = editor.runCommand("gjs-get-inlined-html");
        const out = typeof inlined === "string" ? inlined : `${editor.getHtml()}<style>${editor.getCss()}</style>`;

        // GrapesJS emits the wrapper as <body>. Unwrap it, keep whatever inline
        // styles it picked up, and rebuild the surroundings as nested tables —
        // Gmail and Outlook drop <body> backgrounds, but never a table's.
        let inner = out;
        let bodyStyle = "";
        const m = out.match(/<body([^>]*)>([\s\S]*)<\/body>/i);
        if (m) {
          inner = m[2];
          bodyStyle = (m[1].match(/style\s*=\s*"([^"]*)"/i)?.[1] || "")
            // the scaffold below owns these now
            .replace(/(^|;)\s*(background(-color|-image|-size|-repeat|-position)?|padding|margin)\s*:[^;]*/gi, "")
            .replace(/^;+|;+$/g, "");
        }

        const s = settingsRef.current;
        inner = inlineLinkColor(inner, safeColor(s.linkColor));

        const pageBg = safeColor(s.pageBg);
        const img = safeUrl(s.pageBgImage);
        const fit = FIT[s.pageBgFit] || FIT.cover;
        const contentBg = safeColor(s.contentBg);
        const width = s.contentWidth > 0 ? s.contentWidth : 600;
        const pad = s.outerPadding > 0 ? s.outerPadding : 0;

        const cellStyle = [
          "padding:0",
          s.font && `font-family:${s.font}`,
          safeColor(s.textColor) && `color:${s.textColor}`,
          bodyStyle,
        ].filter(Boolean).join(";");

        const content =
          `<table role="presentation" align="center" width="${width}" cellpadding="0" cellspacing="0" border="0"` +
          `${contentBg ? ` bgcolor="${contentBg}"` : ""}` +
          ` style="width:${width}px;max-width:100%;margin:0 auto;${contentBg ? `background-color:${contentBg};` : ""}">` +
          `<tr><td data-email-content="1" style="${cellStyle}">${inner}</td></tr></table>`;

        const bgStyle = [
          pageBg && `background-color:${pageBg};`,
          img && `background-image:url('${img}');background-size:${fit.size};background-repeat:${fit.repeat};background-position:${s.pageBgPosition};`,
        ].filter(Boolean).join("");

        // Outlook ignores CSS background images; it needs VML instead. Its
        // v:fill takes an opacity directly, so it gets the real thing.
        const opacity = clamp01(s.pageBgOpacity);
        const vmlOpen = img
          ? `<!--[if gte mso 9]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="mso-width-percent:1000;">` +
            `<v:fill type="frame" src="${escAttr(img)}"${pageBg ? ` color="${pageBg}"` : ""}` +
            `${opacity < 1 ? ` opacity="${Math.round(opacity * 100)}%"` : ""} />` +
            `<v:textbox inset="0,0,0,0"><![endif]-->`
          : "";
        const vmlClose = img ? `<!--[if gte mso 9]></v:textbox></v:rect><![endif]-->` : "";

        // Everywhere else, dim the image with a translucent sheet of the page
        // colour laid over it — CSS gradients don't survive most email clients,
        // but an rgba background on a table cell does.
        const veil = img && opacity < 1 ? rgba(pageBg || "#ffffff", 1 - opacity) : "";
        const padded = `padding:${pad}px 0;`;
        const body = veil
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${veil};">` +
            `<tr><td align="center" valign="top" style="${padded}">${content}</td></tr></table>`
          : content;

        return (
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"` +
          `${pageBg ? ` bgcolor="${pageBg}"` : ""}` +
          ` style="width:100%;margin:0;padding:0;${bgStyle}">` +
          `<tr><td align="center" valign="top"${img ? ` background="${escAttr(img)}"` : ""}` +
          ` style="${veil ? "padding:0;" : padded}${bgStyle}">` +
          `${vmlOpen}${body}${vmlClose}` +
          `</td></tr></table>`
        );
      },
      getDesign: () => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...((editor as any).getProjectData() as object),
        emailSettings: settingsRef.current,
      }),
    });

    return () => {
      editor.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repaint the canvas whenever the email-wide settings change.
  useEffect(() => {
    const editor = editorRef.current;
    if (editor) paintCanvas(editor, settings);
  }, [settings]);

  /**
   * The Style Manager's colour picker positions itself from document
   * coordinates, walking up offsetParents and subtracting their scrollTop. Our
   * design panel scrolls but is unpositioned, so it isn't an offsetParent and
   * its scroll is never subtracted — the picker lands as far below the swatch
   * as the panel is scrolled. Re-anchor it to the swatch instead.
   */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    let swatch: HTMLElement | null = null;

    const anchor = () => {
      if (!swatch?.isConnected) return;
      const picker = Array.from(document.querySelectorAll<HTMLElement>(".sp-container"))
        .find((el) => el.style.display !== "none" && el.offsetParent !== null);
      if (!picker) return;
      const r = swatch.getBoundingClientRect();
      const w = picker.offsetWidth || 240;
      const h = picker.offsetHeight || 300;
      const below = r.bottom + 8;
      picker.style.position = "fixed";
      picker.style.margin = "0";
      picker.style.left = `${Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))}px`;
      picker.style.top = `${below + h <= window.innerHeight - 8 ? below : Math.max(8, r.top - h - 8)}px`;
    };

    const onPointerDown = (e: Event) => {
      const hit = (e.target as HTMLElement | null)?.closest?.(".gjs-field-color-picker, .sp-replacer");
      swatch = (hit as HTMLElement) || null;
      if (swatch) requestAnimationFrame(anchor);
    };

    panel.addEventListener("mousedown", onPointerDown, true);
    panel.addEventListener("scroll", anchor, true);
    window.addEventListener("resize", anchor);
    return () => {
      panel.removeEventListener("mousedown", onPointerDown, true);
      panel.removeEventListener("scroll", anchor, true);
      window.removeEventListener("resize", anchor);
    };
  }, []);

  /* ---------------------------- UI bits --------------------------- */

  const iconBtn = (
    label: string,
    Icon: typeof Undo2,
    onClick: () => void,
    opts: { active?: boolean; disabled?: boolean; danger?: boolean } = {},
  ) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={opts.disabled}
      className={`p-1.5 rounded-md transition-all disabled:opacity-35 disabled:cursor-not-allowed ${
        opts.active
          ? "bg-white text-teal-700 shadow-sm ring-1 ring-black/5"
          : opts.danger
            ? "text-red-500 hover:bg-white hover:text-red-600 hover:shadow-sm"
            : "text-slate-600 hover:bg-white hover:text-navy-900 hover:shadow-sm"
      }`}
    >
      <Icon className="w-[17px] h-[17px]" />
    </button>
  );

  const swatchRow = (label: string, value: string, swatches: string[], onPick: (c: string) => void) => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-slate-600">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Transparent, as a real swatch — "no background" is a choice people
            need to make deliberately once a background image is in play. */}
        <button
          type="button"
          title="Transparent"
          onClick={() => onPick("")}
          className={`w-6 h-6 rounded-full border transition-all flex items-center justify-center ${
            !value ? "border-teal-500 ring-2 ring-teal-500/30 scale-110" : "border-slate-200 hover:scale-110"
          }`}
          style={{
            backgroundImage:
              "linear-gradient(45deg,#cbd5e1 25%,transparent 25%,transparent 75%,#cbd5e1 75%)," +
              "linear-gradient(45deg,#cbd5e1 25%,#fff 25%,#fff 75%,#cbd5e1 75%)",
            backgroundSize: "8px 8px",
            backgroundPosition: "0 0, 4px 4px",
          }}
        >
          {!value && <Check className="w-3 h-3 text-slate-700" />}
        </button>
        {swatches.map((c) => {
          const on = value.toLowerCase() === c;
          return (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => onPick(c)}
              className={`w-6 h-6 rounded-full border transition-all flex items-center justify-center ${
                on ? "border-teal-500 ring-2 ring-teal-500/30 scale-110" : "border-slate-200 hover:scale-110"
              }`}
              style={{ backgroundColor: c }}
            >
              {on && <Check className={`w-3 h-3 ${c === "#0d1b2a" || c === "#134e4a" ? "text-white" : "text-slate-700"}`} />}
            </button>
          );
        })}
        <label
          title="Custom color"
          className="w-6 h-6 rounded-full border border-slate-200 cursor-pointer relative overflow-hidden hover:scale-110 transition-transform"
          style={{ background: "conic-gradient(#ef4444,#eab308,#22c55e,#06b6d4,#6366f1,#ec4899,#ef4444)" }}
        >
          <input type="color" value={value || "#ffffff"} onChange={(e) => onPick(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
      </div>
    </div>
  );

  /** A row of three segmented icon buttons. */
  const alignRow = (
    label: string,
    current: string,
    options: { value: string; Icon: typeof AlignLeft; title: string }[],
    onPick: (v: string) => void,
    disabled = false,
  ) => (
    <div className="flex items-center gap-2">
      <span className="w-11 text-[10.5px] text-slate-500 flex-shrink-0">{label}</span>
      <div className={`flex-1 flex gap-1 p-0.5 bg-slate-100 rounded-lg ${disabled ? "opacity-40" : ""}`}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            title={disabled ? "Select a section or cell to align vertically" : o.title}
            onClick={() => onPick(o.value)}
            disabled={disabled}
            className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all disabled:cursor-not-allowed ${
              current === o.value ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <o.Icon className="w-4 h-4" />
          </button>
        ))}
      </div>
    </div>
  );

  const tabBtn = (id: Tab, Icon: typeof Sliders, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-[11px] font-semibold tracking-wide transition-colors relative ${
        tab === id ? "text-teal-700" : "text-slate-400 hover:text-slate-700"
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
      {tab === id && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-teal-600 rounded-full" />}
    </button>
  );

  return (
    <div className="h-full w-full flex flex-col bg-white">
      <style>{THEME_CSS}</style>

      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-white flex-wrap">
        <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg">
          {iconBtn("Undo", Undo2, () => editorRef.current?.UndoManager.undo())}
          {iconBtn("Redo", Redo2, () => editorRef.current?.UndoManager.redo())}
        </div>

        <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg">
          {iconBtn("Desktop width", Monitor, () => switchDevice("desktop"), { active: device === "desktop" })}
          {iconBtn("Mobile width", Smartphone, () => switchDevice("mobile"), { active: device === "mobile" })}
        </div>

        <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg">
          {iconBtn("Align left", AlignLeft, () => applyAlign("left"), { active: align === "left", disabled: !selection })}
          {iconBtn("Align center", AlignCenter, () => applyAlign("center"), { active: align === "center", disabled: !selection })}
          {iconBtn("Align right", AlignRight, () => applyAlign("right"), { active: align === "right", disabled: !selection })}
        </div>

        <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg">
          {iconBtn("Duplicate", Copy, () => run("tlb-clone"), { disabled: !selection })}
          {iconBtn("Delete", Trash2, () => run("core:component-delete"), { disabled: !selection, danger: true })}
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          {selection ? (
            <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              <strong className="text-navy-900 font-semibold">{selection}</strong>
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 hidden md:flex items-center gap-1.5">
              <MousePointerClick className="w-3.5 h-3.5" /> Click anything in the email to style it
            </span>
          )}
          <button
            type="button"
            onClick={togglePreview}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
              previewing ? "bg-teal-600 text-white shadow-sm" : "border border-slate-200 bg-white text-navy-900 hover:bg-slate-50"
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>
        </div>
      </div>

      {/* Three panes */}
      <div className="flex-1 min-h-0 flex">
        {/* Blocks */}
        <aside className="w-[204px] flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto email-scroll hidden sm:block">
          <div className="px-4 pt-3.5 pb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            <LayoutGrid className="w-3.5 h-3.5" /> Blocks
          </div>
          <p className="px-4 text-[10.5px] text-slate-400 leading-snug">Drag onto the email.</p>
          <div ref={blocksRef} />
        </aside>

        {/* Canvas */}
        <div className="flex-1 min-w-0 bg-[#eceff3]">
          <div ref={canvasRef} className="h-full" />
        </div>

        {/* Design panel */}
        <aside ref={panelRef} className="w-[298px] flex-shrink-0 border-l border-slate-200 bg-white overflow-y-auto email-scroll">
          {/* Email-wide settings */}
          <div className="border-b border-slate-200">
            <button
              type="button"
              onClick={() => setEmailOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <span className="flex items-center gap-1.5"><Palette className="w-3.5 h-3.5" /> Email body</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${emailOpen ? "" : "-rotate-90"}`} />
            </button>

            {emailOpen && (
              <div className="px-4 pb-5 space-y-5">
                {swatchRow("Background color", settings.pageBg, PAGE_SWATCHES, (c) => set("pageBg", c))}

                <BgImageField
                  value={{ image: settings.pageBgImage, fit: settings.pageBgFit, position: settings.pageBgPosition, opacity: settings.pageBgOpacity }}
                  onChange={(v) => setSettings((prev) => ({
                    ...prev,
                    pageBgImage: v.image,
                    pageBgFit: v.fit,
                    pageBgPosition: v.position,
                    pageBgOpacity: v.opacity,
                  }))}
                  veilColor={safeColor(settings.pageBg) || "#ffffff"}
                  note="Outlook needs a fallback — keep a background color set behind the image."
                />

                <div className="h-px bg-slate-100" />

                {swatchRow("Content background", settings.contentBg, CONTENT_SWATCHES, (c) => set("contentBg", c))}

                {!!safeUrl(settings.pageBgImage) && !isSeeThrough(settings.contentBg) && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 flex items-start gap-2 -mt-2">
                    <Info className="w-3.5 h-3.5 text-amber-600 mt-px flex-shrink-0" />
                    <div className="text-[10.5px] text-amber-900 leading-relaxed">
                      A solid content background covers your background image behind the content.
                      <button
                        type="button"
                        onClick={() => set("contentBg", "")}
                        className="block mt-1.5 font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700"
                      >
                        Make it transparent
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1.5">Content width</label>
                    <div className="relative">
                      <input
                        type="number" min={280} max={900} step={10}
                        value={settings.contentWidth}
                        onChange={(e) => set("contentWidth", parseInt(e.target.value, 10) || 600)}
                        className="w-full pl-2.5 pr-7 py-1.5 text-[11px] border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">px</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1.5">Outer padding</label>
                    <div className="relative">
                      <input
                        type="number" min={0} max={80} step={4}
                        value={settings.outerPadding}
                        onChange={(e) => set("outerPadding", parseInt(e.target.value, 10) || 0)}
                        className="w-full pl-2.5 pr-7 py-1.5 text-[11px] border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">px</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1.5">Default font</label>
                  <select
                    value={settings.font}
                    onChange={(e) => set("font", e.target.value)}
                    className="w-full px-2.5 py-1.5 text-[11px] border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all"
                  >
                    {FONTS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1.5">Text color</label>
                    <label className="flex items-center gap-2 px-2 py-1.5 border border-slate-200 rounded-lg cursor-pointer hover:border-teal-400 transition-colors">
                      <span className="w-4 h-4 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: settings.textColor || "#1f2937" }} />
                      <span className="text-[10.5px] text-slate-500 truncate">{settings.textColor || "Inherit"}</span>
                      <input type="color" value={settings.textColor || "#1f2937"} onChange={(e) => set("textColor", e.target.value)} className="sr-only" />
                    </label>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1.5">Link color</label>
                    <label className="flex items-center gap-2 px-2 py-1.5 border border-slate-200 rounded-lg cursor-pointer hover:border-teal-400 transition-colors">
                      <span className="w-4 h-4 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: settings.linkColor || "#0d9488" }} />
                      <span className="text-[10.5px] text-slate-500 truncate">{settings.linkColor || "Inherit"}</span>
                      <input type="color" value={settings.linkColor || "#0d9488"} onChange={(e) => set("linkColor", e.target.value)} className="sr-only" />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Selected element */}
          <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
            {tabBtn("design", Sliders, "Design")}
            {tabBtn("settings", Settings2, "Settings")}
            {tabBtn("layers", Layers, "Layers")}
          </div>

          {!selection && tab !== "layers" && (
            <div className="px-5 py-8 text-center">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <MousePointerClick className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Nothing selected. Click a heading, paragraph, image, button or section
                and its controls appear here.
              </p>
            </div>
          )}

          <div className={tab === "design" && selection ? "" : "hidden"}>
            {blocker && (
              <div className="mx-3 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-amber-600 mt-px flex-shrink-0" />
                <div className="text-[10.5px] text-amber-900 leading-relaxed">
                  This element is transparent, but <strong>{blocker.name}</strong> sits between it and
                  the email background image.
                  <button
                    type="button"
                    onClick={clearBlocker}
                    className="block mt-1.5 font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700"
                  >
                    Make {blocker.kind === "content" ? "it" : `“${blocker.name}”`} transparent
                  </button>
                </div>
              </div>
            )}
            {/* Where this container's contents sit, across and down. */}
            <div className="px-[14px] pt-3.5 pb-4 border-b border-slate-100">
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-2.5">
                Content alignment
              </div>
              <div className="space-y-2">
                {alignRow("Across", align, [
                  { value: "left", Icon: AlignLeft, title: "Left" },
                  { value: "center", Icon: AlignCenter, title: "Center" },
                  { value: "right", Icon: AlignRight, title: "Right" },
                ], applyAlign)}
                {alignRow("Down", vAlign, [
                  { value: "top", Icon: AlignVerticalJustifyStart, title: "Top" },
                  { value: "middle", Icon: AlignVerticalJustifyCenter, title: "Middle" },
                  { value: "bottom", Icon: AlignVerticalJustifyEnd, title: "Bottom" },
                ], applyVAlign, !canVAlign)}
              </div>
              <p className="mt-2 text-[10px] text-slate-400 leading-snug">
                {canVAlign
                  ? "Vertical alignment shows once the section is taller than its contents — set a Height under Spacing & size."
                  : "Vertical alignment needs a Section block (a table cell). Plain containers have no portable way to do it in email."}
              </p>
            </div>

            <div ref={stylesRef} />
            {/* Sits directly under the Style Manager's "Background & border",
                replacing GrapesJS's layer-chip control, which has no opacity. */}
            <div className="px-[14px] pb-5 pt-1">
              <BgImageField
                value={selBg}
                onChange={(v) => applySelBg(v, selVeil)}
                veilColor={selVeil}
                note="Dimmed toward this element's background color. Outlook can't show element background images at all — keep a background color set."
              />
            </div>
          </div>
          <div className={tab === "settings" && selection ? "" : "hidden"}>
            <div ref={traitsRef} />
          </div>
          <div className={tab === "layers" ? "" : "hidden"}>
            <div ref={layersRef} />
          </div>
        </aside>
      </div>
    </div>
  );
}
