"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import grapesjs, { type Editor } from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import presetNewsletter from "grapesjs-preset-newsletter";
import {
  AlignCenter, AlignLeft, AlignRight, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart, Check, ChevronDown, Copy, Eye, ImagePlus, Layers,
  Info, LayoutGrid, Loader2, Monitor, Moon, MousePointerClick, Palette, Plus, Redo2, Settings2, Smartphone, Sun,
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
  /** Dark mode — overrides applied when the recipient's client is in dark mode. */
  darkMode: boolean;
  darkPageBg: string;
  darkContentBg: string;
  darkText: string;
  darkLink: string;
  /** Per-element dark-mode overrides, keyed by the component's id. `img` is a
   *  swapped-in image for dark mode (light/dark logo). */
  darkStyles: Record<string, { color?: string; bg?: string; img?: string }>;
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
  darkMode: false,
  darkPageBg: "#0b1220",
  darkContentBg: "#111827",
  darkText: "#e5e7eb",
  darkLink: "#5eead4",
  darkStyles: {},
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

// System fonts render everywhere with no loading. Kept first because they are
// the safe default for email.
const SYSTEM_FONTS = [
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "Helvetica, Arial, sans-serif", label: "Helvetica" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
  { value: "Tahoma, Verdana, sans-serif", label: "Tahoma" },
  { value: "'Trebuchet MS', Helvetica, sans-serif", label: "Trebuchet MS" },
  { value: "Georgia, 'Times New Roman', serif", label: "Georgia" },
  { value: "'Times New Roman', Times, serif", label: "Times New Roman" },
  { value: "'Courier New', Courier, monospace", label: "Courier New" },
];

// The Google Fonts catalogue we offer — the popular families that cover
// essentially all real-world use. Each is loaded on demand (only when picked
// or used), never all at once.
const GOOGLE_FAMILIES = [
  "Poppins", "Montserrat", "Roboto", "Open Sans", "Lato", "Nunito", "Nunito Sans", "Raleway", "Oswald",
  "Inter", "Work Sans", "Rubik", "Mulish", "Quicksand", "Josefin Sans", "Barlow", "Karla", "DM Sans",
  "Manrope", "Figtree", "Outfit", "Sora", "Space Grotesk", "Plus Jakarta Sans", "Archivo", "Kanit",
  "Titillium Web", "Fira Sans", "PT Sans", "Source Sans 3", "Noto Sans", "Roboto Condensed", "Roboto Mono",
  "Cabin", "Comfortaa", "Dosis", "Exo 2", "Heebo", "Hind", "IBM Plex Sans", "IBM Plex Mono", "Inconsolata",
  "Libre Franklin", "Maven Pro", "Overpass", "Oxygen", "Prompt", "Questrial", "Signika", "Teko", "Ubuntu",
  "Varela Round", "Abel", "Anton", "Bebas Neue", "Fjalla One", "Righteous", "Jost", "Lexend",
  "Red Hat Display", "Urbanist", "Assistant", "Catamaran", "Chivo", "Asap",
  // Serif
  "Merriweather", "Playfair Display", "Lora", "PT Serif", "Source Serif 4", "Noto Serif", "Roboto Slab",
  "Bitter", "IBM Plex Serif", "Libre Baskerville", "Cormorant Garamond", "Crimson Text", "EB Garamond",
  "Arvo", "Domine", "Vollkorn", "Cardo", "Spectral", "Frank Ruhl Libre", "Zilla Slab", "Slabo 27px",
  "Cinzel", "Alegreya", "Abril Fatface",
  // Display / script
  "Lobster", "Pacifico", "Great Vibes", "Dancing Script", "Caveat", "Satisfy", "Permanent Marker",
  "Shadows Into Light", "Indie Flower", "Amatic SC", "Courgette", "Sacramento", "Yellowtail",
];

const SERIF_FAMILIES = new Set([
  "Merriweather", "Playfair Display", "Lora", "PT Serif", "Source Serif 4", "Noto Serif", "Roboto Slab",
  "Bitter", "IBM Plex Serif", "Libre Baskerville", "Cormorant Garamond", "Crimson Text", "EB Garamond",
  "Arvo", "Domine", "Vollkorn", "Cardo", "Spectral", "Frank Ruhl Libre", "Zilla Slab", "Slabo 27px",
  "Cinzel", "Alegreya", "Abril Fatface",
]);
const MONO_FAMILIES = new Set(["Roboto Mono", "IBM Plex Mono", "Inconsolata"]);
const CURSIVE_FAMILIES = new Set([
  "Lobster", "Pacifico", "Great Vibes", "Dancing Script", "Caveat", "Satisfy", "Permanent Marker",
  "Shadows Into Light", "Indie Flower", "Amatic SC", "Courgette", "Sacramento", "Yellowtail",
]);

function fontFallback(name: string): string {
  if (SERIF_FAMILIES.has(name)) return "Georgia, 'Times New Roman', serif";
  if (MONO_FAMILIES.has(name)) return "'Courier New', Courier, monospace";
  if (CURSIVE_FAMILIES.has(name)) return "'Brush Script MT', cursive";
  return "Helvetica, Arial, sans-serif";
}
const fontValue = (name: string) => `'${name}', ${fontFallback(name)}`;
const fontSpec = (name: string) => `${name.replace(/ /g, "+")}:wght@400;500;600;700`;
const googleHref = (name: string) => `https://fonts.googleapis.com/css2?family=${fontSpec(name)}&display=swap`;

// Recover the primary family name from a font-family value string.
function familyName(value: string): string {
  const m = String(value || "").match(/^\s*['"]?([^'",]+)/);
  return m ? m[1].trim() : "";
}
const GOOGLE_SET = new Set(GOOGLE_FAMILIES);

const GOOGLE_FONTS = GOOGLE_FAMILIES.map((name) => ({ value: fontValue(name), label: name, g: fontSpec(name) }));
const FONTS = [{ value: "", label: "Inherit" }, ...SYSTEM_FONTS, ...GOOGLE_FONTS];

/** Inject a Google font's stylesheet into `doc` (idempotent). No-op for non-Google families. */
function ensureFontInDoc(doc: Document | null | undefined, name: string) {
  if (!doc?.head || !name || !GOOGLE_SET.has(name)) return;
  const id = "gf-" + name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  if (doc.getElementById(id)) return;
  const link = doc.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = googleHref(name);
  doc.head.appendChild(link);
}

/** Every Google font-family referenced in `html` + `font`, as css2 family specs, for a scoped export import. */
function googleFontsUsed(html: string, font: string): string[] {
  const hay = `${html} ${font}`;
  return GOOGLE_FAMILIES.filter((name) => hay.includes(`'${name}'`) || hay.includes(`"${name}"`)).map(fontSpec);
}

const PAGE_SWATCHES = ["#ffffff", "#f1f5f9", "#e2e8f0", "#f0fdfa", "#fff7ed", "#fdf2f8", "#134e4a", "#0d1b2a"];
const CONTENT_SWATCHES = ["#ffffff", "#fafafa", "#f8fafc", "#f0fdfa", "#fffbeb", "#0d1b2a"];

// Brand palette, cached at module scope so a freshly-mounted editor can seed
// its GrapesJS colour pickers synchronously (the API load fills it in too).
let BRAND_CACHE: string[] = [];

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
/* RTE text-colour swatch — a button that opens our own picker, styled with an
   "A" over a colour bar so it reads as text colour. */
.email-rte-color {
  display:inline-flex; flex-direction:column; align-items:center; justify-content:center;
  width:20px; height:18px; cursor:pointer; line-height:1;
}
.email-rte-color::before { content:"A"; font-size:11px; font-weight:700; color:#e2e8f0; }
.email-rte-color-dot { width:14px; height:3px; border-radius:2px; margin-top:1px; background:#111827; }

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
      { property: "font-family", name: "Font", type: "select", default: "", options: FONTS.map((f) => ({ id: f.value, label: f.label })) },
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

/** Compact image chooser (upload / URL / library) for the dark-mode logo swap. */
function DarkImagePicker({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [library, setLibrary] = useState<{ name: string; url: string }[]>([]);

  async function upload(file: File) {
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/email-assets", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (data.url) onChange(data.url);
    } finally { setBusy(false); }
  }
  async function openLib() {
    setLibOpen((o) => !o);
    if (!library.length) {
      const res = await fetch("/api/admin/email-assets").catch(() => null);
      const data = res ? await res.json().catch(() => ({ assets: [] })) : { assets: [] };
      setLibrary(Array.isArray(data.assets) ? data.assets : []);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-slate-600">Dark-mode image</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={openLib} className="text-[10px] text-teal-600 hover:text-teal-700 flex items-center gap-0.5"><LayoutGrid className="w-3 h-3" /> Library</button>
          {value && <button type="button" onClick={() => onChange("")} className="text-[10px] text-slate-400 hover:text-red-600 flex items-center gap-0.5"><X className="w-3 h-3" /> Remove</button>}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      {libOpen && (
        <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          {library.length === 0 ? (
            <p className="text-[10.5px] text-slate-400 text-center py-2">No images yet.</p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto email-scroll">
              {library.map((a) => (
                <button key={a.url} type="button" title={a.name} onClick={() => { onChange(a.url); setLibOpen(false); }}
                  className={`aspect-square rounded-md bg-white bg-cover bg-center border-2 ${a.url === value ? "border-teal-500" : "border-slate-200"}`}
                  style={{ backgroundImage: `url("${a.url}")` }} />
              ))}
            </div>
          )}
        </div>
      )}
      <div onClick={() => !busy && fileRef.current?.click()}
        className="relative h-16 rounded-lg border-2 border-dashed border-slate-200 hover:border-teal-400 cursor-pointer flex items-center justify-center transition-colors"
        style={safeUrl(value) ? { backgroundImage: `url("${safeUrl(value)}")`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center", borderStyle: "solid" } : undefined}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          : !safeUrl(value) && <span className="flex items-center gap-1 text-[10.5px] text-slate-400"><ImagePlus className="w-4 h-4" /> Upload dark logo</span>}
      </div>
      <input type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder="…or paste an image URL"
        className="mt-1.5 w-full px-2 py-1.5 text-[10.5px] border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none" />
    </div>
  );
}

function BgImageField({
  value,
  onChange,
  veilColor,
  note,
  label = "Background image",
}: {
  value: BgImage;
  onChange: (next: BgImage) => void;
  /** The colour the image is dimmed toward — normally whatever sits behind it. */
  veilColor: string;
  note?: string;
  label?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [library, setLibrary] = useState<{ name: string; url: string }[]>([]);
  const [libLoading, setLibLoading] = useState(false);

  const url = safeUrl(value.image);
  const opacity = clamp01(value.opacity);
  const sheet = 1 - opacity;
  const veil = veilColor || "#ffffff";

  const loadLibrary = useCallback(async () => {
    setLibLoading(true);
    try {
      const res = await fetch("/api/admin/email-assets");
      const data = await res.json().catch(() => ({ assets: [] }));
      setLibrary(Array.isArray(data.assets) ? data.assets : []);
    } catch {
      setLibrary([]);
    } finally {
      setLibLoading(false);
    }
  }, []);

  const toggleLibrary = useCallback(() => {
    setLibOpen((open) => {
      if (!open) loadLibrary();
      return !open;
    });
  }, [loadLibrary]);

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
      // A fresh upload belongs in the library too.
      setLibrary((prev) => (prev.some((a) => a.url === data.url) ? prev : [{ name: data.url, url: data.url }, ...prev]));
    } catch {
      setError("Upload failed — check your connection.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-slate-600">{label}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLibrary}
            className={`text-[10px] transition-colors flex items-center gap-0.5 ${libOpen ? "text-teal-700 font-semibold" : "text-teal-600 hover:text-teal-700"}`}
          >
            <LayoutGrid className="w-3 h-3" /> Library
          </button>
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
      </div>

      {libOpen && (
        <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
          {libLoading ? (
            <div className="h-16 flex items-center justify-center text-[11px] text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Loading…
            </div>
          ) : library.length === 0 ? (
            <p className="text-[10.5px] text-slate-400 text-center py-3">No images yet — upload one and it&apos;ll be saved here.</p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto email-scroll">
              {library.map((a) => {
                const on = a.url === value.image;
                return (
                  <button
                    key={a.url}
                    type="button"
                    title={a.name}
                    onClick={() => { onChange({ ...value, image: a.url }); setLibOpen(false); }}
                    className={`aspect-square rounded-lg bg-white bg-cover bg-center border-2 transition-all hover:scale-[1.04] ${on ? "border-teal-500 ring-2 ring-teal-500/30" : "border-slate-200"}`}
                    style={{ backgroundImage: `url("${a.url}")` }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

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

/* ------------------------------------------------------------------ *
 * Custom colour picker — replaces the browser's native <input type=color>,
 * which opens the OS colour panel and can't show brand colours. Palette +
 * hex + a real HSV spectrum, all in-app.
 * ------------------------------------------------------------------ */

const clampU = (n: number) => Math.min(1, Math.max(0, n));

function normHex(h: string): string {
  let s = (h || "").trim().toLowerCase();
  if (s && !s.startsWith("#")) s = "#" + s;
  if (/^#[0-9a-f]{3}$/.test(s)) s = "#" + s.slice(1).split("").map((c) => c + c).join("");
  return /^#[0-9a-f]{6}$/.test(s) ? s : "";
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const h = normHex(hex) || "#000000";
  const r = parseInt(h.slice(1, 3), 16) / 255, g = parseInt(h.slice(3, 5), 16) / 255, b = parseInt(h.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let hh = 0;
  if (d) {
    if (max === r) hh = ((g - b) / d) % 6;
    else if (max === g) hh = (b - r) / d + 2;
    else hh = (r - g) / d + 4;
    hh = hh * 60;
    if (hh < 0) hh += 360;
  }
  return { h: hh, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return "#" + to(r) + to(g) + to(b);
}

/* ------------------------------------------------------------------ *
 * Searchable font picker — the whole Google-font catalogue we bundle,
 * filtered as you type. Each option previews in its own font.
 * ------------------------------------------------------------------ */
function FontPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const current = FONTS.find((f) => f.value === value)?.label || "Inherit";
  const q = query.trim().toLowerCase();
  const results = q ? FONTS.filter((f) => f.label.toLowerCase().includes(q)) : FONTS;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [open]);

  // Preview each option in its own font: load the Google ones into THIS document.
  useEffect(() => {
    if (!open) return;
    results.slice(0, 40).forEach((f) => ensureFontInDoc(document, familyName(f.value)));
  }, [open, results]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setQuery(""); }}
        className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] border border-slate-200 rounded-lg bg-white hover:border-teal-400 focus:ring-2 focus:ring-teal-500/30 outline-none transition-all"
      >
        <span style={{ fontFamily: value || undefined }} className="truncate">{current}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 left-0 right-0 rounded-lg border border-slate-200 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.16)] overflow-hidden">
          <div className="p-1.5 border-b border-slate-100">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${GOOGLE_FAMILIES.length}+ fonts…`}
              className="w-full px-2 py-1.5 text-[11px] border border-slate-200 rounded-md focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto email-scroll py-1">
            {results.length === 0 && <p className="px-3 py-2 text-[11px] text-slate-400">No match</p>}
            {results.map((f) => (
              <button
                key={f.label}
                type="button"
                onClick={() => { onChange(f.value); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-slate-50 ${f.value === value ? "text-teal-700 font-semibold" : "text-slate-700"}`}
                style={{ fontFamily: f.value || undefined }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const PICKER_PRESETS = [
  "#000000", "#475569", "#94a3b8", "#e2e8f0", "#ffffff",
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#0ea5e9", "#3b82f6", "#6366f1", "#a855f7", "#ec4899",
  "#7f1d1d", "#78350f", "#134e4a", "#0d1b2a", "#0d9488",
];

function ColorPopover({
  x, y, value, brand, onPick, onClose,
}: {
  x: number; y: number; value: string; brand: string[];
  onPick: (hex: string) => void; onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [hexText, setHexText] = useState(() => normHex(value) || "#000000");

  // Commit a colour: update the local UI and apply it to the selection.
  const commit = useCallback((next: { h: number; s: number; v: number }) => {
    setHsv(next);
    const hx = hsvToHex(next.h, next.s, next.v);
    setHexText(hx);
    onPick(hx);
  }, [onPick]);

  // Drag within a box; `read` maps a pointer position to the new HSV.
  const drag = (
    read: (px: number, py: number, rect: DOMRect) => { h: number; s: number; v: number },
  ) => (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const move = (cx: number, cy: number) => commit(read(cx, cy, rect));
    move(e.clientX, e.clientY);
    const onMove = (ev: PointerEvent) => move(ev.clientX, ev.clientY);
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onSV = drag((px, py, rect) => ({
    h: hsv.h,
    s: clampU((px - rect.left) / rect.width),
    v: 1 - clampU((py - rect.top) / rect.height),
  }));
  const onHue = drag((px, _py, rect) => ({
    h: clampU((px - rect.left) / rect.width) * 360,
    s: hsv.s || 1,
    v: hsv.v || 1,
  }));

  // Close on outside click / Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("mousedown", onDown, true); document.removeEventListener("keydown", onKey, true); };
  }, [onClose]);

  const hueColor = hsvToHex(hsv.h, 1, 1);
  const swatch = (c: string, isBrand = false) => (
    <button
      key={(isBrand ? "b" : "p") + c}
      type="button"
      title={isBrand ? `Brand · ${c}` : c}
      onClick={() => { const n = hexToHsv(c); setHsv(n); setHexText(c); onPick(c); }}
      className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${isBrand ? "border-2 border-teal-400" : "border border-slate-200"}`}
      style={{ backgroundColor: c }}
    />
  );

  // Keep the popover on-screen.
  const width = 232, height = 300;
  const left = Math.max(8, Math.min(x, window.innerWidth - width - 8));
  const top = y + height > window.innerHeight - 8 ? Math.max(8, y - height - 40) : y;

  return (
    <div
      ref={rootRef}
      className="fixed z-[2147483600] w-[232px] rounded-xl border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.22)] p-3"
      style={{ left, top }}
    >
      {/* Saturation / value */}
      <div
        onPointerDown={onSV}
        className="relative h-32 w-full rounded-lg cursor-crosshair touch-none"
        style={{ backgroundColor: hueColor, backgroundImage: "linear-gradient(to right,#fff,rgba(255,255,255,0)),linear-gradient(to top,#000,rgba(0,0,0,0))" }}
      >
        <span
          className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white shadow ring-1 ring-black/20 pointer-events-none"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: hexText }}
        />
      </div>

      {/* Hue */}
      <div
        onPointerDown={onHue}
        className="relative h-3 w-full rounded-full mt-3 cursor-pointer touch-none"
        style={{ backgroundImage: "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" }}
      >
        <span
          className="absolute top-1/2 w-3.5 h-3.5 -ml-1.5 -mt-1.5 rounded-full border-2 border-white shadow ring-1 ring-black/20 pointer-events-none"
          style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueColor }}
        />
      </div>

      {/* Hex */}
      <div className="mt-3 flex items-center gap-2">
        <span className="w-6 h-6 rounded-md border border-slate-200 flex-shrink-0" style={{ backgroundColor: hexText }} />
        <input
          value={hexText}
          onChange={(e) => {
            setHexText(e.target.value);
            const n = normHex(e.target.value);
            if (n) { setHsv(hexToHsv(n)); onPick(n); }
          }}
          spellCheck={false}
          className="flex-1 min-w-0 px-2 py-1 text-[11px] font-mono border border-slate-200 rounded-md focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none uppercase"
        />
      </div>

      {brand.length > 0 && (
        <>
          <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Brand</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{brand.map((c) => swatch(c, true))}</div>
        </>
      )}

      <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Presets</div>
      <div className="mt-1.5 grid grid-cols-10 gap-1">{PICKER_PRESETS.map((c) => swatch(c))}</div>
    </div>
  );
}

/** Wrap exactly `range` in a coloured <span>, leaving everything else alone. */
function colorRange(doc: Document, range: Range, color: string): Range | null {
  if (!range || range.collapsed) return null;
  const span = doc.createElement("span");
  span.style.color = color;
  try {
    // extractContents + insert handles a selection that crosses element
    // boundaries; surroundContents would throw on those.
    span.appendChild(range.extractContents());
    range.insertNode(span);
  } catch {
    return null;
  }
  // Strip colour from any inner spans so re-colouring the same words replaces
  // the colour instead of nesting a new layer over it; unwrap ones left empty.
  span.querySelectorAll("span").forEach((el) => {
    el.style.removeProperty("color");
    if (!el.getAttribute("style")?.trim()) el.replaceWith(...Array.from(el.childNodes));
  });
  // Re-colouring the exact same words leaves us wrapped in the old colour span;
  // flatten any parent span that now wraps only us so colours don't accumulate.
  let parent = span.parentElement;
  while (parent && parent.tagName === "SPAN" && parent.childNodes.length === 1) {
    parent.replaceWith(span);
    parent = span.parentElement;
  }
  // Merge any adjacent text nodes the split left behind.
  span.parentNode?.normalize();
  const after = doc.createRange();
  after.selectNodeContents(span);
  return after;
}

/** What the RTE colour swatch hands to the React layer when clicked. */
interface RtePickerOpen {
  x: number;
  y: number;
  color: string;
  apply: (hex: string) => void;
}

/**
 * Colour just the highlighted words. The Style Manager's colour applies to a
 * whole component, so this lives on the rich-text toolbar instead, where a
 * text selection actually exists.
 *
 * The toolbar swatch is a plain button — clicking it opens our own colour
 * popover (not the OS picker). We snapshot the selection on pointerdown, while
 * it is still live, then wrap that exact range by hand each time the popover
 * reports a colour.
 */
function addTextColorAction(editor: Editor, onOpen: (o: RtePickerOpen) => void) {
  const rte = editor.RichTextEditor;
  if (rte.get("forecolor")) return;

  let saved: Range | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apply = (r: any) => (hex: string) => {
    const doc: Document | undefined = r.doc;
    const range = saved && !saved.collapsed ? saved : null;
    if (!doc || !range) return; // nothing highlighted — don't paint the whole block
    const next = colorRange(doc, range, hex);
    if (next) {
      const sel = doc.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(next);
      saved = next.cloneRange();
      (r.el as HTMLElement | undefined)?.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  rte.add("forecolor", {
    icon: '<span class="email-rte-color" title="Colour the selected text"><span class="email-rte-color-dot" style="background:#111827"></span></span>',
    attributes: { title: "Text colour" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result: (r: any, action: any) => {
      const btn = action.btn as HTMLElement | undefined;
      const rect = btn?.getBoundingClientRect();
      const color = toHex(String(r.doc?.queryCommandValue("foreColor") || "")) || "#111827";
      onOpen({ x: rect ? rect.left : 200, y: rect ? rect.bottom + 6 : 200, color, apply: apply(r) });
    },
    // Keep the swatch dot showing the colour under the caret.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: (r: any, action: any) => {
      const dot = action.btn?.querySelector?.(".email-rte-color-dot") as HTMLElement | undefined;
      const current = toHex(String(r.doc?.queryCommandValue("foreColor") || ""));
      if (dot && current) dot.style.background = current;
      return 0;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  // The toolbar sits in the top document; the text lives in the canvas iframe.
  // Capture the live selection the instant the swatch is pressed, before the
  // click moves focus out of the editable and collapses it.
  const grab = (e: Event) => {
    const t = e.target as HTMLElement | null;
    if (!t?.closest?.(".email-rte-color")) return;
    let cdoc: Document | null = null;
    try { cdoc = editor.Canvas.getDocument(); } catch { /* not ready */ }
    const sel = cdoc?.getSelection();
    saved = sel && sel.rangeCount && !sel.isCollapsed ? sel.getRangeAt(0).cloneRange() : null;
  };
  document.addEventListener("pointerdown", grab, true);
  document.addEventListener("mousedown", grab, true);
  editor.on("destroy", () => {
    document.removeEventListener("pointerdown", grab, true);
    document.removeEventListener("mousedown", grab, true);
  });
}

/** Mirror the email settings into the canvas iframe so the editor is WYSIWYG. */
function paintCanvas(editor: Editor, s: EmailSettings, dark = false) {
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
  // When previewing dark mode, swap the page/content/text/link colours for the
  // dark set (the background image still shows over the dark page colour).
  const pageBg = dark ? safeColor(s.darkPageBg) : safeColor(s.pageBg);
  const contentBg = dark ? safeColor(s.darkContentBg) : safeColor(s.contentBg);
  const textColor = dark ? safeColor(s.darkText) : safeColor(s.textColor);
  const linkColor = dark ? safeColor(s.darkLink) : safeColor(s.linkColor);
  const veil = clamp01(s.pageBgOpacity) < 1
    ? rgba(pageBg || (dark ? "#0b1220" : "#ffffff"), 1 - clamp01(s.pageBgOpacity))
    : "";
  // GrapesJS styles the wrapper through an #id rule, which outranks a plain
  // `body` selector — hence !important throughout. This is preview-only CSS;
  // the exported email is built separately.
  el.textContent = [
    "body { margin:0 !important;",
    pageBg ? `background-color:${pageBg} !important;` : "",
    img
      ? `background-image:${veil ? `linear-gradient(${veil},${veil}),` : ""}url("${img}") !important;` +
        `background-size:${fit.size} !important;` +
        `background-repeat:${fit.repeat} !important;background-position:${s.pageBgPosition} !important;`
      : "",
    s.outerPadding ? `padding:${s.outerPadding}px 0 !important;` : "",
    s.font ? `font-family:${s.font} !important;` : "",
    // In dark mode the default text is forced (matches export); light mode isn't.
    textColor ? `color:${textColor} ${dark ? "!important" : "!important"};` : "",
    "}",
    // In dark preview, flip default text on content descendants too — but not
    // !important on colour so an element's own accent colour still wins.
    dark && textColor ? `body > * , body > * * { color:${textColor}; }` : "",
    // Deliberately not !important — GrapesJS styles each element through an
    // #id rule, so an element's own background must be able to win here.
    "body > * { margin-left:auto; margin-right:auto;",
    s.contentWidth ? `max-width:${s.contentWidth}px;` : "",
    contentBg ? `background-color:${contentBg}${dark ? " !important" : ""};` : "",
    "}",
    linkColor ? `a { color:${linkColor} !important; }` : "",
    // Per-element dark overrides — only in the dark preview.
    dark ? darkOverrideCss(s.darkStyles) : "",
  ].join("");
}

/** `#id{color:…!important;background-color:…!important}` for each per-element dark override. */
function darkOverrideCss(darkStyles: EmailSettings["darkStyles"]): string {
  return Object.entries(darkStyles || {})
    .map(([id, o]) => {
      const parts = [
        o.color && `color:${o.color} !important`,
        o.bg && `background-color:${o.bg} !important`,
      ].filter(Boolean).join(";");
      return parts ? `#${id}{${parts}}` : "";
    })
    .filter(Boolean)
    .join("");
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
  // Remembers each swapped image's light src while the dark preview is showing.
  const lightSrcRef = useRef<Record<string, string>>({});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saved = (initialDesign as any)?.emailSettings as Partial<EmailSettings> | undefined;
  const [settings, setSettings] = useState<EmailSettings>(() => ({
    ...(initialDesign && Object.keys(initialDesign).length ? EXISTING_DESIGN : NEW_DESIGN),
    ...(saved || {}),
  }));
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [selection, setSelection] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [selType, setSelType] = useState<string>("");
  const [align, setAlign] = useState("");
  const [vAlign, setVAlign] = useState("");
  /** Canvas preview mode — see the design as it looks in a light or dark inbox. */
  const [darkPreview, setDarkPreview] = useState(false);
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
  const [brandColors, setBrandColors] = useState<string[]>(BRAND_CACHE);
  // The custom colour popover for the rich-text (selected words) swatch.
  const [rtePicker, setRtePicker] = useState<RtePickerOpen | null>(null);

  const set = useCallback(<K extends keyof EmailSettings>(key: K, value: EmailSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  /** Set (or clear, with "") a dark-mode override (colour, background, or swapped image) on the selected element. */
  const setDarkStyle = useCallback((prop: "color" | "bg" | "img", value: string) => {
    if (!selId) return;
    setSettings((prev) => {
      const map = { ...(prev.darkStyles || {}) };
      const entry = { ...(map[selId] || {}) };
      if (value) entry[prop] = value; else delete entry[prop];
      if (Object.keys(entry).length) map[selId] = entry; else delete map[selId];
      return { ...prev, darkStyles: map };
    });
  }, [selId]);

  // Load into the canvas every Google font referenced by a component style or
  // by the email-body default font — on demand, so we never pull all ~100.
  const loadFontsInCanvas = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    let doc: Document | null | undefined;
    try { doc = editor.Canvas.getDocument(); } catch { return; }
    if (!doc) return;
    const names = new Set<string>();
    (editor.getCss?.() || "").replace(/font-family\s*:\s*([^;}"']+)/gi, (_m: string, v: string) => {
      names.add(familyName(v));
      return _m;
    });
    names.add(familyName(settingsRef.current.font));
    names.forEach((n) => ensureFontInDoc(doc, n));
  }, []);

  // Push the palette into GrapesJS so every Style Manager colour picker (bg,
  // border, element text) opens with the brand colours as its swatches. Read
  // fresh at each picker open, so updating it takes effect on the next open.
  const seedGjsPalette = useCallback((colors: string[]) => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor.getConfig() as any).colorPicker = { palette: colors.length ? [colors] : [] };
    } catch { /* ignore */ }
  }, []);

  // Load the saved brand palette once; keep the module cache in step so the
  // GrapesJS colour pickers (opened per element) can seed from it too.
  useEffect(() => {
    let live = true;
    fetch("/api/admin/email-brand")
      .then((r) => (r.ok ? r.json() : { colors: [] }))
      .then((d) => { if (live) { BRAND_CACHE = d.colors || []; setBrandColors(BRAND_CACHE); seedGjsPalette(BRAND_CACHE); } })
      .catch(() => {});
    return () => { live = false; };
  }, [seedGjsPalette]);

  const persistBrand = useCallback((colors: string[]) => {
    BRAND_CACHE = colors;
    setBrandColors(colors);
    seedGjsPalette(colors);
    fetch("/api/admin/email-brand", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colors }),
    }).catch(() => {});
  }, [seedGjsPalette]);

  const addBrandColor = useCallback((c: string) => {
    const v = (c || "").trim().toLowerCase();
    if (!/^#[0-9a-f]{3,8}$/.test(v)) return;
    setBrandColors((prev) => {
      if (prev.includes(v)) return prev;
      const next = [...prev, v].slice(0, 24);
      BRAND_CACHE = next;
      seedGjsPalette(next);
      fetch("/api/admin/email-brand", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ colors: next }),
      }).catch(() => {});
      return next;
    });
  }, [seedGjsPalette]);

  const removeBrandColor = useCallback((c: string) => {
    setBrandColors((prev) => {
      const next = prev.filter((x) => x !== c);
      persistBrand(next);
      return next;
    });
  }, [persistBrand]);

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
      // Images must be URLs in email — NEVER base64. A data: URI bloats the
      // HTML to megabytes and email clients (and Brevo) block, truncate, or
      // show it as raw text. Upload dropped/added images to our public bucket
      // and reference the returned URL instead.
      assetManager: {
        embedAsBase64: false,
        autoAdd: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        uploadFile: async (ev: any) => {
          const files: FileList | undefined = ev?.dataTransfer?.files ?? ev?.target?.files;
          if (!files?.length) return;
          for (const file of Array.from(files)) {
            try {
              const body = new FormData();
              body.append("file", file);
              const res = await fetch("/api/admin/email-assets", { method: "POST", body });
              const data = await res.json().catch(() => ({}));
              if (data.url) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (editorRef.current as any)?.AssetManager.add(data.url);
              } else {
                editorRef.current?.Modal.open({ title: "Upload failed", content: data.error || "Could not upload image." });
              }
            } catch {
              editorRef.current?.Modal.open({ title: "Upload failed", content: "Could not upload image — check your connection." });
            }
          }
        },
      },
      // Seed every Style Manager colour picker with the saved brand palette.
      colorPicker: { palette: BRAND_CACHE.length ? [BRAND_CACHE] : undefined },
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
        setSelId(null);
        setSelType("");
        setAlign("");
        setVAlign("");
        setCanVAlign(false);
        setSelBg(NO_BG);
        return;
      }
      setSelection(sel.getName?.() || String(sel.get("type") || "Element"));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSelId((sel as any).getId?.() || null);
      setSelType(String(sel.get("type") || (String(sel.get("tagName") || "").toLowerCase() === "img" ? "image" : "")));
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
      addTextColorAction(editor, (o) => setRtePicker(o));
      paintCanvas(editor, settingsRef.current);
      loadFontsInCanvas();
      // The preset hides component outlines by default, which makes empty
      // cells impossible to find. Turn them on.
      editor.runCommand("core:component-outline");
    });
    // Load any font used by a component the moment its styles change.
    editor.on("component:styleUpdate", loadFontsInCanvas);
    editor.on("component:add", loadFontsInCanvas);

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
        // An <img> should never carry a background-image (an artifact of the
        // element background control being applied to an image); strip it, and
        // give images email-friendly defaults so they render and reserve space
        // even while a client is blocking remote images.
        inner = inner.replace(/<img\b[^>]*>/gi, (tag) => {
          let out = tag.replace(/style\s*=\s*"([^"]*)"/i, (_m, css: string) => {
            const cleaned = css
              // background-image first — its url() may contain escaped quotes (which hold ";")
              .replace(/background-image\s*:\s*url\([^)]*\)\s*;?/gi, "")
              .replace(/background(-size|-repeat|-position|-color|-attachment)\s*:[^;]*;?/gi, "")
              .replace(/;\s*;+/g, ";").replace(/^\s*;+|;+\s*$/g, "").trim();
            return cleaned ? `style="${cleaned}"` : "";
          });
          if (!/\bborder\s*=/.test(out)) out = out.replace(/<img\b/i, '<img border="0"');
          return out;
        });

        // Light/dark image swap: for any image with a dark-mode image set, ship
        // BOTH — the light one (hidden in dark) and the dark one (hidden by
        // default, shown in dark). CSS can't change an <img src>, so we toggle
        // visibility via the same @media / [data-ogsc] rules below.
        for (const [id, o] of Object.entries(s.darkStyles || {})) {
          const darkImg = safeUrl(o?.img || "");
          if (!darkImg) continue;
          inner = inner.replace(new RegExp(`<img\\b[^>]*\\bid="${id}"[^>]*>`, "i"), (tag) => {
            const lightImg = tag.replace(/<img\b/i, '<img class="em-dl" ');
            let dark = tag
              .replace(/\bid="[^"]*"/i, "")               // no duplicate id
              .replace(/\bsrc="[^"]*"/i, `src="${escAttr(darkImg)}"`)
              .replace(/<img\b/i, '<img class="em-dd" ');
            // hidden unless the client is in dark mode
            dark = /style\s*=\s*"/i.test(dark)
              ? dark.replace(/style\s*=\s*"([^"]*)"/i, (_m, st: string) => `style="display:none;mso-hide:all;${st}"`)
              : dark.replace(/<img\b/i, '<img style="display:none;mso-hide:all"');
            return lightImg + dark;
          });
        }

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
          `<table role="presentation" align="center" width="${width}" cellpadding="0" cellspacing="0" border="0" class="em-content"` +
          `${contentBg ? ` bgcolor="${contentBg}"` : ""}` +
          ` style="width:${width}px;max-width:100%;margin:0 auto;${contentBg ? `background-color:${contentBg};` : ""}">` +
          `<tr><td data-email-content="1" class="em-content-c" style="${cellStyle}">${inner}</td></tr></table>`;

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

        // Pull in any Google fonts actually used. @import is honoured by the
        // clients that support web fonts (Apple Mail, iOS Mail); everywhere else
        // the font-family stacks fall back to a system font, so nothing breaks.
        const usedFonts = googleFontsUsed(inner, s.font);
        const fontImport = usedFonts.length
          ? `<style>@import url('https://fonts.googleapis.com/css2?${usedFonts.map((g) => "family=" + g).join("&")}&display=swap');</style>`
          : "";

        // Dark mode — clients that honour prefers-color-scheme (Apple Mail,
        // iOS Mail) swap in these colours; Outlook.com uses [data-ogsc]. Others
        // ignore it and show the light design. !important beats the inline
        // styles. Only the default text colour is flipped, so accent colours
        // (headings, buttons the user coloured) stay put in both modes.
        const dpb = safeColor(s.darkPageBg) || "#0b1220";
        const dcb = safeColor(s.darkContentBg) || "#111827";
        const dtx = safeColor(s.darkText) || "#e5e7eb";
        const dlk = safeColor(s.darkLink) || "#5eead4";
        // All dark rules for a given selector prefix ("" for @media, "[data-ogsc] "
        // for Outlook.com). Per-element overrides are keyed by component id.
        // Any element with a swapped dark image needs the show/hide toggle.
        const hasImgSwap = Object.values(s.darkStyles || {}).some((o) => safeUrl(o?.img || ""));
        const darkRules = (p: string) =>
          `${p}.em-page,${p}.em-page-c{background-color:${dpb}!important}` +
          `${p}.em-content{background-color:${dcb}!important}` +
          `${p}.em-content-c{color:${dtx}!important}` +
          `${p}.em-content-c a{color:${dlk}!important}` +
          (hasImgSwap ? `${p}.em-dl{display:none!important}${p}.em-dd{display:inline-block!important}` : "") +
          Object.entries(s.darkStyles || {})
            .map(([id, o]) => {
              const parts = [o.color && `color:${o.color}!important`, o.bg && `background-color:${o.bg}!important`]
                .filter(Boolean).join(";");
              return parts ? `${p}#${id}{${parts}}` : "";
            })
            .filter(Boolean).join("");
        const darkCss = s.darkMode
          ? `<style>@media (prefers-color-scheme:dark){${darkRules("")}}${darkRules("[data-ogsc] ")}</style>`
          : "";

        return (
          fontImport + darkCss +
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="em-page"` +
          `${pageBg ? ` bgcolor="${pageBg}"` : ""}` +
          ` style="width:100%;margin:0;padding:0;${bgStyle}">` +
          `<tr><td align="center" valign="top" class="em-page-c"${img ? ` background="${escAttr(img)}"` : ""}` +
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

  // Repaint the canvas whenever the email-wide settings or preview mode change.
  useEffect(() => {
    const editor = editorRef.current;
    if (editor) paintCanvas(editor, settings, darkPreview);
    loadFontsInCanvas();
    // Swap dark-mode images in the canvas preview only (never touches the model,
    // so the export keeps the light src). Light src is remembered in a ref.
    try {
      const cdoc = editor?.Canvas.getDocument();
      if (cdoc) {
        Object.entries(settings.darkStyles || {}).forEach(([id, o]) => {
          const el = cdoc.getElementById(id) as HTMLImageElement | null;
          if (!el || el.tagName !== "IMG") return;
          const di = safeUrl(o?.img || "");
          if (darkPreview && di) {
            if (lightSrcRef.current[id] === undefined) lightSrcRef.current[id] = el.getAttribute("src") || "";
            el.setAttribute("src", di);
          } else if (lightSrcRef.current[id] !== undefined) {
            el.setAttribute("src", lightSrcRef.current[id]);
            delete lightSrcRef.current[id];
          }
        });
      }
    } catch { /* canvas not ready */ }
  }, [settings, darkPreview, loadFontsInCanvas]);

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
        {/* Brand colours first, then the presets (skipping any duplicates). */}
        {[...brandColors, ...swatches.filter((c) => !brandColors.includes(c))].map((c) => {
          const on = value.toLowerCase() === c;
          const isBrand = brandColors.includes(c);
          return (
            <button
              key={c}
              type="button"
              title={isBrand ? `Brand · ${c}` : c}
              onClick={() => onPick(c)}
              className={`w-6 h-6 rounded-full transition-all flex items-center justify-center ${
                on ? "ring-2 ring-teal-500/40 scale-110" : "hover:scale-110"
              } ${isBrand ? "border-2 border-teal-400" : "border border-slate-200"}`}
              style={{ backgroundColor: c }}
            >
              {on && <Check className={`w-3 h-3 ${/^#(0|1|2|3|4|5)/.test(c) ? "text-white" : "text-slate-700"}`} />}
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
        {/* Save the current colour to the brand palette. */}
        {value && !brandColors.includes(value.toLowerCase()) && (
          <button
            type="button"
            title="Save to brand colors"
            onClick={() => addBrandColor(value)}
            className="w-6 h-6 rounded-full border border-dashed border-slate-300 text-slate-400 hover:border-teal-400 hover:text-teal-600 flex items-center justify-center transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
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

        {/* Preview the design as a light or dark inbox would show it. */}
        <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg">
          {iconBtn("Light mode preview", Sun, () => setDarkPreview(false), { active: !darkPreview })}
          {iconBtn("Dark mode preview", Moon, () => setDarkPreview(true), { active: darkPreview })}
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
                {/* Brand palette — appears in every colour row and every element picker. */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-slate-600">Brand colors</span>
                    <label
                      title="Add a brand color"
                      className="text-[10px] text-teal-600 hover:text-teal-700 cursor-pointer flex items-center gap-0.5 relative"
                    >
                      <Plus className="w-3 h-3" /> Add
                      <input
                        type="color"
                        defaultValue="#0d9488"
                        onChange={(e) => addBrandColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full"
                      />
                    </label>
                  </div>
                  {brandColors.length === 0 ? (
                    <p className="text-[10px] text-slate-400 leading-snug">
                      Save colors here and they&apos;ll show first in every color picker — background, text, buttons, borders.
                    </p>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {brandColors.map((c) => (
                        <div key={c} className="group relative">
                          <span
                            title={c}
                            className="block w-6 h-6 rounded-full border-2 border-teal-400"
                            style={{ backgroundColor: c }}
                          />
                          <button
                            type="button"
                            title="Remove"
                            onClick={() => removeBrandColor(c)}
                            className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-white border border-slate-300 text-slate-500 hidden group-hover:flex items-center justify-center hover:text-red-600"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="h-px bg-slate-100" />

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
                  label="Background image (whole email)"
                  note="Sits behind the entire email and works in all clients, Outlook included. Keep a background color set as the fallback."
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
                  <FontPicker value={settings.font} onChange={(v) => set("font", v)} />
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

                <div className="h-px bg-slate-100" />

                {/* Dark mode */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                      <Moon className="w-3.5 h-3.5" /> Dark mode
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.darkMode}
                      onClick={() => { set("darkMode", !settings.darkMode); if (!settings.darkMode) setDarkPreview(true); }}
                      className={`relative w-9 h-5 rounded-full transition-colors ${settings.darkMode ? "bg-teal-600" : "bg-slate-300"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${settings.darkMode ? "translate-x-4" : ""}`} />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug mt-1.5">
                    When on, these colors swap in for recipients whose email app is in dark mode (Apple Mail, iOS Mail, Outlook.com). Accent colors you set on headings and buttons stay the same. Use the ☾ button up top to preview.
                  </p>

                  {settings.darkMode && (
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2.5">
                        {([
                          ["darkPageBg", "Background", "#0b1220"],
                          ["darkContentBg", "Content", "#111827"],
                          ["darkText", "Text", "#e5e7eb"],
                          ["darkLink", "Links", "#5eead4"],
                        ] as const).map(([key, lbl, def]) => (
                          <div key={key}>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1.5">{lbl}</label>
                            <label className="flex items-center gap-2 px-2 py-1.5 border border-slate-200 rounded-lg cursor-pointer hover:border-teal-400 transition-colors">
                              <span className="w-4 h-4 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: settings[key] || def }} />
                              <span className="text-[10.5px] text-slate-500 truncate">{settings[key] || def}</span>
                              <input type="color" value={settings[key] || def} onChange={(e) => set(key, e.target.value)} className="sr-only" />
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
            {/* Per-element dark-mode colour override for the selected element. */}
            {settings.darkMode && selId && (() => {
              const dv = settings.darkStyles?.[selId] || {};
              return (
                <div className="px-[14px] pt-3.5 pb-4 border-b border-slate-100 bg-slate-900/[0.03]">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-2.5">
                    <Moon className="w-3.5 h-3.5" /> Dark mode · this element
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-medium text-slate-600">Text</span>
                        {dv.color && <button type="button" onClick={() => setDarkStyle("color", "")} className="text-[10px] text-slate-400 hover:text-slate-600">Reset</button>}
                      </div>
                      <label className="flex items-center gap-2 px-2 py-1.5 border border-slate-200 rounded-lg cursor-pointer hover:border-teal-400 transition-colors">
                        <span className="w-4 h-4 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: dv.color || settings.darkText }} />
                        <span className="text-[10.5px] text-slate-500 truncate">{dv.color || "Default"}</span>
                        <input type="color" value={dv.color || settings.darkText} onChange={(e) => setDarkStyle("color", e.target.value)} className="sr-only" />
                      </label>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-medium text-slate-600">Background</span>
                        {dv.bg && <button type="button" onClick={() => setDarkStyle("bg", "")} className="text-[10px] text-slate-400 hover:text-slate-600">Reset</button>}
                      </div>
                      <label className="flex items-center gap-2 px-2 py-1.5 border border-slate-200 rounded-lg cursor-pointer hover:border-teal-400 transition-colors">
                        <span className="w-4 h-4 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: dv.bg || "transparent" }} />
                        <span className="text-[10.5px] text-slate-500 truncate">{dv.bg || "None"}</span>
                        <input type="color" value={dv.bg || "#111827"} onChange={(e) => setDarkStyle("bg", e.target.value)} className="sr-only" />
                      </label>
                    </div>
                  </div>
                  {selType === "image" && (
                    <div className="mt-3">
                      <DarkImagePicker value={dv.img || ""} onChange={(u) => setDarkStyle("img", u)} />
                      <p className="text-[10px] text-slate-400 leading-snug mt-1">
                        Ships both images; dark-mode inboxes show this one. (Apple Mail, iOS Mail, Outlook.com — Gmail keeps the light image.)
                      </p>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 leading-snug mt-2">
                    Only changes this element in dark mode. Its light-mode colors stay as set. {!darkPreview && "Switch to the ☾ preview to see it."}
                  </p>
                </div>
              );
            })()}
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
                label="Background image (this element only)"
                note="Applies only to the selected element, and Outlook can't show it. For a background behind the whole email, use Email body → Background image at the top instead."
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

      {/* Custom colour picker for the rich-text (selected words) swatch. */}
      {rtePicker && (
        <ColorPopover
          x={rtePicker.x}
          y={rtePicker.y}
          value={rtePicker.color}
          brand={brandColors}
          onPick={(hex) => rtePicker.apply(hex)}
          onClose={() => setRtePicker(null)}
        />
      )}
    </div>
  );
}
