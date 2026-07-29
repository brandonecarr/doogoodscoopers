"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import grapesjs, { type Editor } from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import presetNewsletter from "grapesjs-preset-newsletter";
import {
  AlignCenter, AlignLeft, AlignRight, ChevronDown, Copy, Eye, Layers, LayoutGrid,
  Monitor, MousePointerClick, Redo2, Settings2, Smartphone, Sliders, Trash2, Undo2,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Email-wide settings — the "body" controls Brevo puts above everything
 * else. Kept in React state (not GrapesJS) so they can drive both the
 * canvas preview and the exported email scaffold.
 * ------------------------------------------------------------------ */

export interface EmailSettings {
  pageBg: string;
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
  contentBg: "#ffffff",
  contentWidth: 600,
  outerPadding: 24,
  font: "Arial, Helvetica, sans-serif",
  textColor: "#1f2937",
  linkColor: "#0d9488",
};

/** Designs saved before these controls existed: change nothing they didn't ask for. */
const EXISTING_DESIGN: EmailSettings = {
  pageBg: "",
  contentBg: "",
  contentWidth: 600,
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

const PAGE_SWATCHES = ["#ffffff", "#f1f5f9", "#eef2f7", "#f0fdfa", "#fff7ed", "#fdf2f8", "#0d1b2a", "#134e4a"];
const CONTENT_SWATCHES = ["#ffffff", "#fafafa", "#f8fafc", "#f0fdfa", "#fffbeb", "#0d1b2a"];

const HEX = /^#[0-9a-f]{3,8}$/i;
const safeColor = (c: string) => (c && HEX.test(c) ? c : "");

/* ------------------------------------------------------------------ *
 * Editor chrome
 * ------------------------------------------------------------------ */

// GrapesJS ships a dark theme and expects Font Awesome for its icons. We load
// neither, so this repaints the managers light (to sit in the white sidebars)
// and turns the icon-only radio groups — alignment among them — into readable
// segmented controls instead of blank squares.
const THEME_CSS = `
.gjs-editor-cont .gjs-pn-panels { display:none !important; }
.gjs-editor-cont .gjs-cv-canvas { top:0 !important; width:100% !important; height:100% !important; }

.gjs-one-bg { background-color:#ffffff; }
.gjs-two-color { color:#0f172a; }
.gjs-three-bg { background-color:#14b8a6; color:#fff; }
.gjs-four-color, .gjs-four-color-h:hover { color:#14b8a6; }

.gjs-sm-sector-title {
  background:#f8fafc; border-bottom:1px solid #e5e7eb; color:#0f172a;
  font-size:11px; font-weight:600; letter-spacing:.03em; text-transform:uppercase; padding:8px 10px;
}
.gjs-sm-sector .gjs-sm-properties { padding:10px; }
.gjs-sm-label, .gjs-label, .gjs-trt-trait__label, .gjs-clm-tags-label { color:#64748b; font-size:11px; }
.gjs-field {
  background-color:#fff; border:1px solid #e2e8f0; border-radius:6px; color:#0f172a;
}
.gjs-field input, .gjs-field select, .gjs-field textarea { color:#0f172a; }
.gjs-field-arrow-u { border-bottom-color:#94a3b8; }
.gjs-field-arrow-d { border-top-color:#94a3b8; }
.gjs-sm-property { margin-bottom:8px; }

.gjs-blocks-c { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; padding:10px; }
.gjs-block {
  width:auto; min-height:64px; margin:0; padding:8px 4px; font-size:10.5px; line-height:1.3;
  background:#fff; border:1px solid #e2e8f0; border-radius:8px; color:#475569; box-shadow:none;
}
.gjs-block:hover { border-color:#14b8a6; color:#0f766e; }
.gjs-block__media svg { width:24px; height:24px; }
.gjs-block-category .gjs-title { background:#f8fafc; color:#0f172a; font-size:11px; }

.gjs-layer-title { background:#fff; color:#0f172a; }
.gjs-layer-name { font-size:12px; }
.gjs-trt-trait { padding:5px 10px; }

/* Radio groups (alignment, decoration) as a visible segmented control. */
.gjs-radio-items { display:flex; gap:4px; flex-wrap:wrap; }
.gjs-radio-item { flex:1 1 0; min-width:52px; border:none; }
.gjs-radio-item-label {
  display:block; text-align:center; padding:5px 4px; font-size:11px; cursor:pointer;
  border:1px solid #e2e8f0; border-radius:6px; color:#334155;
}
.gjs-radio-item-label:hover { border-color:#14b8a6; }
.gjs-radio-item input:checked + .gjs-radio-item-label {
  background:#14b8a6; color:#fff; border-color:#14b8a6;
}
`;

// Style Manager sectors, replacing the preset's. Grouped the way Brevo groups
// them, open by default, and with text labels on every radio option.
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
    id: "background",
    name: "Background & border",
    open: true,
    buildProps: ["background-color", "border-radius", "border", "background"],
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
      {
        property: "background",
        name: "Background image",
        properties: [
          { name: "Image", property: "background-image" },
          { name: "Repeat", property: "background-repeat" },
          { name: "Position", property: "background-position" },
          { name: "Size", property: "background-size" },
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
];

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
  el.textContent = [
    `body { margin:0;`,
    s.pageBg ? `background-color:${s.pageBg};` : "",
    s.outerPadding ? `padding:${s.outerPadding}px 0;` : "",
    s.font ? `font-family:${s.font};` : "",
    s.textColor ? `color:${s.textColor};` : "",
    `}`,
    `body > * { margin-left:auto; margin-right:auto;`,
    s.contentWidth ? `max-width:${s.contentWidth}px;` : "",
    s.contentBg ? `background-color:${s.contentBg};` : "",
    `}`,
    s.linkColor ? `a { color:${s.linkColor}; }` : "",
  ].join("");
}

/** Email clients ignore <style>; push the link colour onto each anchor. */
function inlineLinkColor(html: string, color: string) {
  if (!color) return html;
  return html.replace(/<a\b([^>]*)>/gi, (whole, attrs: string) => {
    if (/color\s*:/i.test(attrs)) return whole;
    if (/style\s*=\s*"/i.test(attrs)) {
      return `<a${attrs.replace(/style\s*=\s*"([^"]*)"/i, (_m, st: string) => `style="${st};color:${color}"`)}>`;
    }
    return `<a${attrs} style="color:${color}">`;
  });
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
    // An image only obeys its cell's text-align while it stays inline.
    const sel = editor.getSelected();
    if (sel?.get("type") === "image") sel.addStyle({ display: "inline-block", float: "none" });
    setAlign(value);
  }, []);

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
        return;
      }
      setSelection(sel.getName?.() || String(sel.get("type") || "Element"));
      const style = (alignTarget(editor)?.getStyle() || {}) as Record<string, string>;
      setAlign(style["text-align"] || "");
    };
    editor.on("component:selected", syncSelection);
    editor.on("component:deselected", syncSelection);

    // Load existing design (preferred) or seed HTML.
    try {
      if (initialDesign && Object.keys(initialDesign).length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (editor as any).loadProjectData(initialDesign);
      } else if (initialHtml) {
        editor.setComponents(initialHtml);
      }
    } catch { /* fall back to empty canvas */ }

    editor.onReady(() => {
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
            .replace(/(^|;)\s*(background(-color|-image)?|padding|margin)\s*:[^;]*/gi, "")
            .replace(/^;+|;+$/g, "");
        }

        const s = settingsRef.current;
        inner = inlineLinkColor(inner, safeColor(s.linkColor));

        const pageBg = safeColor(s.pageBg);
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
          `<tr><td style="${cellStyle}">${inner}</td></tr></table>`;

        return (
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"` +
          `${pageBg ? ` bgcolor="${pageBg}"` : ""}` +
          ` style="width:100%;margin:0;padding:0;${pageBg ? `background-color:${pageBg};` : ""}">` +
          `<tr><td align="center" valign="top" style="padding:${pad}px 0;${pageBg ? `background-color:${pageBg};` : ""}">` +
          `${content}</td></tr></table>`
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

  /* -------------------------------------------------------------- */

  const colorRow = (
    label: string,
    value: string,
    swatches: string[],
    onPick: (c: string) => void,
  ) => (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-gray-600">{label}</span>
        <div className="flex items-center gap-1">
          <label
            className="w-5 h-5 rounded border border-gray-300 cursor-pointer relative overflow-hidden"
            style={{ background: value || "conic-gradient(#ef4444,#eab308,#22c55e,#06b6d4,#6366f1,#ec4899,#ef4444)" }}
            title="Pick any color"
          >
            <input type="color" value={value || "#ffffff"} onChange={(e) => onPick(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
          </label>
          <button type="button" onClick={() => onPick("")} className="text-[10px] text-gray-400 hover:text-gray-600 px-1">
            clear
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => onPick(c)}
            className={`w-5 h-5 rounded border transition-transform hover:scale-110 ${value.toLowerCase() === c ? "border-teal-600 ring-2 ring-teal-500/40" : "border-gray-300"}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );

  const alignBtn = (value: string, Icon: typeof AlignLeft, label: string) => (
    <button
      type="button"
      title={selection ? `Align ${label}` : "Select something on the canvas first"}
      onClick={() => applyAlign(value)}
      disabled={!selection}
      className={`p-1.5 rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        align === value ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-gray-200 text-navy-900 hover:bg-gray-50"
      }`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  const tabBtn = (id: Tab, Icon: typeof Sliders, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-medium border-b-2 transition-colors ${
        tab === id ? "border-teal-600 text-teal-700" : "border-transparent text-gray-500 hover:text-navy-900"
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );

  return (
    <div className="h-full w-full flex flex-col bg-gray-50">
      <style>{THEME_CSS}</style>

      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white flex-wrap">
        <div className="flex items-center gap-1">
          <button type="button" title="Undo" onClick={() => editorRef.current?.UndoManager.undo()} className="p-1.5 rounded-md border border-gray-200 text-navy-900 hover:bg-gray-50">
            <Undo2 className="w-4 h-4" />
          </button>
          <button type="button" title="Redo" onClick={() => editorRef.current?.UndoManager.redo()} className="p-1.5 rounded-md border border-gray-200 text-navy-900 hover:bg-gray-50">
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div className="h-5 w-px bg-gray-200" />

        <div className="flex items-center gap-1">
          <button type="button" title="Desktop width" onClick={() => switchDevice("desktop")} className={`p-1.5 rounded-md border ${device === "desktop" ? "bg-teal-600 border-teal-600 text-white" : "border-gray-200 text-navy-900 hover:bg-gray-50"}`}>
            <Monitor className="w-4 h-4" />
          </button>
          <button type="button" title="Mobile width" onClick={() => switchDevice("mobile")} className={`p-1.5 rounded-md border ${device === "mobile" ? "bg-teal-600 border-teal-600 text-white" : "border-gray-200 text-navy-900 hover:bg-gray-50"}`}>
            <Smartphone className="w-4 h-4" />
          </button>
        </div>

        <div className="h-5 w-px bg-gray-200" />

        <div className="flex items-center gap-1">
          <span className="text-[11px] font-medium text-gray-600 mr-0.5">Align</span>
          {alignBtn("left", AlignLeft, "left")}
          {alignBtn("center", AlignCenter, "center")}
          {alignBtn("right", AlignRight, "right")}
        </div>

        <div className="h-5 w-px bg-gray-200" />

        <div className="flex items-center gap-1">
          <button type="button" title="Duplicate selected" onClick={() => run("tlb-clone")} disabled={!selection} className="p-1.5 rounded-md border border-gray-200 text-navy-900 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
            <Copy className="w-4 h-4" />
          </button>
          <button type="button" title="Delete selected" onClick={() => run("core:component-delete")} disabled={!selection} className="p-1.5 rounded-md border border-gray-200 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {selection ? (
            <span className="text-[11px] text-gray-500">
              Selected: <strong className="text-navy-900">{selection}</strong>
            </span>
          ) : (
            <span className="text-[11px] text-gray-400 hidden sm:flex items-center gap-1.5">
              <MousePointerClick className="w-3.5 h-3.5" /> Click anything in the email to style it
            </span>
          )}
          <button type="button" onClick={togglePreview} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors font-medium ${previewing ? "bg-teal-600 border-teal-600 text-white" : "border-gray-200 bg-white text-navy-900 hover:bg-gray-50"}`}>
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>
        </div>
      </div>

      {/* Three panes */}
      <div className="flex-1 min-h-0 flex">
        {/* Blocks */}
        <aside className="w-[200px] flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto hidden sm:block">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <LayoutGrid className="w-3.5 h-3.5" /> Blocks
          </div>
          <p className="px-3 pt-2 text-[10px] text-gray-400 leading-snug">Drag a block onto the email.</p>
          <div ref={blocksRef} />
        </aside>

        {/* Canvas */}
        <div className="flex-1 min-w-0">
          <div ref={canvasRef} className="h-full" />
        </div>

        {/* Design panel */}
        <aside className="w-[290px] flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
          {/* Email-wide settings — always reachable, like Brevo's body panel */}
          <div className="border-b border-gray-200">
            <button
              type="button"
              onClick={() => setEmailOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600 hover:bg-gray-50"
            >
              <span className="flex items-center gap-1.5"><Sliders className="w-3.5 h-3.5" /> Email body</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${emailOpen ? "" : "-rotate-90"}`} />
            </button>

            {emailOpen && (
              <div className="px-3 pb-4 space-y-4">
                {colorRow("Background (outside)", settings.pageBg, PAGE_SWATCHES, (c) => set("pageBg", c))}
                {colorRow("Background (content)", settings.contentBg, CONTENT_SWATCHES, (c) => set("contentBg", c))}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Content width</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min={280} max={900} step={10}
                        value={settings.contentWidth}
                        onChange={(e) => set("contentWidth", parseInt(e.target.value, 10) || 600)}
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-2 focus:ring-teal-500"
                      />
                      <span className="text-[10px] text-gray-400">px</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Outer padding</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min={0} max={80} step={4}
                        value={settings.outerPadding}
                        onChange={(e) => set("outerPadding", parseInt(e.target.value, 10) || 0)}
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-2 focus:ring-teal-500"
                      />
                      <span className="text-[10px] text-gray-400">px</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Default font</label>
                  <select
                    value={settings.font}
                    onChange={(e) => set("font", e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:ring-2 focus:ring-teal-500"
                  >
                    {FONTS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Text color</label>
                    <input type="color" value={settings.textColor || "#1f2937"} onChange={(e) => set("textColor", e.target.value)} className="w-full h-7 rounded-md border border-gray-200 cursor-pointer" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Link color</label>
                    <input type="color" value={settings.linkColor || "#0d9488"} onChange={(e) => set("linkColor", e.target.value)} className="w-full h-7 rounded-md border border-gray-200 cursor-pointer" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Selected element */}
          <div className="flex border-b border-gray-200">
            {tabBtn("design", Sliders, "Design")}
            {tabBtn("settings", Settings2, "Settings")}
            {tabBtn("layers", Layers, "Layers")}
          </div>

          {!selection && tab !== "layers" && (
            <p className="px-3 py-4 text-[11px] text-gray-400 leading-relaxed">
              Nothing selected. Click a heading, paragraph, image, button or section in the email and its
              controls appear here.
            </p>
          )}

          <div className={tab === "design" && selection ? "" : "hidden"}>
            <div ref={stylesRef} />
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
