"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Bold, Italic, Underline, Link as LinkIcon, Braces } from "lucide-react";
import { SAMPLE_TOKENS } from "@/lib/sample-tokens";

/* Inline editing of a title/text block right on the canvas. Keeps only the tags an
   email text run supports (b, i, u, s, a, br, span color) and offers a floating
   toolbar: bold, italic, underline, link, and a personalization token picker. */

const ALLOWED = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "A", "BR", "SPAN"]);

/** Normalize contentEditable output to the small inline vocabulary. */
/** Inline style properties that survive editing (what a designed email needs for a span or link). */
const KEPT_PROPS = ["color", "font-size", "font-weight", "font-style", "font-family", "letter-spacing", "text-decoration", "background-color", "border-radius", "padding", "display", "width", "height", "line-height", "text-align", "vertical-align"];
function keptStyle(el: HTMLElement): string {
  const out: string[] = [];
  for (const p of KEPT_PROPS) { const v = el.style.getPropertyValue(p); if (v) out.push(`${p}:${v.replace(/"/g, "'")}`); }
  return out.join(";");
}

export function sanitizeInline(html: string): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild as HTMLElement;
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const tag = el.tagName;
    const inner = Array.from(el.childNodes).map(walk).join("");
    if (tag === "BR") return "<br>";
    if (tag === "DIV" || tag === "P") return (inner ? inner + "<br>" : "");
    if (!ALLOWED.has(tag)) return inner;
    if (tag === "B" || tag === "STRONG") return `<b>${inner}</b>`;
    if (tag === "I" || tag === "EM") return `<i>${inner}</i>`;
    if (tag === "U") return `<u>${inner}</u>`;
    if (tag === "S" || tag === "STRIKE") return `<s>${inner}</s>`;
    if (tag === "A") { const st = keptStyle(el); return `<a href="${(el.getAttribute("href") || "#").replace(/"/g, "&quot;")}"${st ? ` style="${st}"` : ""}>${inner}</a>`; }
    if (tag === "SPAN") {
      const st = keptStyle(el);
      return st ? `<span style="${st}">${inner}</span>` : inner;
    }
    return inner;
  };
  return Array.from(root.childNodes).map(walk).join("").replace(/(<br>)+$/, "");
}

export const TOKENS = Object.keys(SAMPLE_TOKENS).filter((k) => !["name", "dogWord", "numberOfDogs", "unsubscribeUrl"].includes(k));

export function RichText({ html, style, tag = "div", onChange, onFocusChange }: {
  html: string; style: CSSProperties; tag?: "div" | "h1" | "h2" | "h3"; onChange: (html: string) => void; onFocusChange?: (focused: boolean) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [focused, setFocused] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);

  // The editable's contents are owned by the browser while it has focus. React must never
  // re-render them: binding dangerouslySetInnerHTML to `html` made every keystroke (emit →
  // parent state → new prop) rewrite innerHTML, which drops the caret to the start, so the
  // next character landed in front of the last and text came out backwards. Instead the
  // element renders with no children, and external html is pushed in here only when the
  // block isn't being edited (initial mount, undo, panel edits).
  useEffect(() => {
    if (!focused && ref.current && ref.current.innerHTML !== html) ref.current.innerHTML = html;
  }, [html, focused]);

  const exec = (cmd: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, value);
    emit();
  };
  const emit = () => { if (!ref.current) return; const next = sanitizeInline(ref.current.innerHTML); if (next !== html) onChange(next); };
  const insertToken = (t: string) => { exec("insertText", `{{${t}}}`); setTokenOpen(false); };
  const link = () => {
    const sel = window.getSelection();
    const current = sel && sel.anchorNode ? (sel.anchorNode.parentElement?.closest("a")?.getAttribute("href") ?? "") : "";
    const url = window.prompt("Link URL (or a token like {{resumeLink}})", current || "https://");
    if (url === null) return;
    if (!url) exec("unlink"); else exec("createLink", url);
  };

  const Tag = tag as "div";
  return (
    <div className="relative">
      {focused && (
        <div className="absolute -top-9 left-0 z-20 flex items-center gap-0.5 p-1 rounded-lg bg-navy-900 text-white shadow-lg" onMouseDown={(e) => e.preventDefault()}>
          <button type="button" title="Bold" onClick={() => exec("bold")} className="p-1.5 rounded hover:bg-white/15"><Bold className="w-3.5 h-3.5" /></button>
          <button type="button" title="Italic" onClick={() => exec("italic")} className="p-1.5 rounded hover:bg-white/15"><Italic className="w-3.5 h-3.5" /></button>
          <button type="button" title="Underline" onClick={() => exec("underline")} className="p-1.5 rounded hover:bg-white/15"><Underline className="w-3.5 h-3.5" /></button>
          <button type="button" title="Link" onClick={link} className="p-1.5 rounded hover:bg-white/15"><LinkIcon className="w-3.5 h-3.5" /></button>
          <span className="w-px h-4 bg-white/20 mx-0.5" />
          <div className="relative">
            <button type="button" title="Insert personalization" onClick={() => setTokenOpen((o) => !o)} className="p-1.5 rounded hover:bg-white/15 flex items-center gap-1 text-[11px]"><Braces className="w-3.5 h-3.5" /> Token</button>
            {tokenOpen && (
              <div className="absolute left-0 top-full mt-1 w-44 max-h-56 overflow-auto rounded-lg bg-white text-navy-900 shadow-xl border border-gray-200 py-1">
                {TOKENS.map((t) => <button key={t} type="button" onClick={() => insertToken(t)} className="block w-full text-left px-3 py-1 text-[12px] hover:bg-violet-50">{`{{${t}}}`}</button>)}
              </div>
            )}
          </div>
        </div>
      )}
      <Tag
        ref={ref as React.RefObject<HTMLDivElement>}
        contentEditable
        suppressContentEditableWarning
        style={{ ...style, outline: "none", minHeight: "1em", cursor: "text" }}
        onFocus={() => { setFocused(true); onFocusChange?.(true); }}
        onBlur={() => { setFocused(false); setTokenOpen(false); emit(); onFocusChange?.(false); }}
        onInput={emit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); document.execCommand("insertHTML", false, "<br>"); emit(); }
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); link(); }
        }}
        onPaste={(e) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); }}
      />
    </div>
  );
}
