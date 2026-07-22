"use client";

import { useEffect, useRef } from "react";
import grapesjs, { type Editor } from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import presetNewsletter from "grapesjs-preset-newsletter";

// Brand theming for the GrapesJS editor chrome (navy/teal to match admin).
const THEME_CSS = `
.gjs-one-bg { background-color: #0d1b2a; }
.gjs-two-color { color: #e5e7eb; }
.gjs-three-bg { background-color: #14b8a6; color:#fff; }
.gjs-four-color, .gjs-four-color-h:hover { color: #14b8a6; }
.gjs-pn-btn.gjs-pn-active, .gjs-pn-btn:hover { color:#14b8a6; }
.gjs-block { border-radius:8px; }
.gjs-block:hover { color:#14b8a6; }
`;

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

export default function EmailBuilder({ initialHtml, initialDesign, onReady }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    if (!ref.current || editorRef.current) return;

    const editor = grapesjs.init({
      container: ref.current,
      height: "100%",
      fromElement: false,
      storageManager: false,
      assetManager: { embedAsBase64: true },
      plugins: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ed: Editor) => (presetNewsletter as any)(ed, {
          modalTitleImport: "Import email HTML",
          inlineCss: true,
        }),
      ],
    });
    editorRef.current = editor;

    // Load existing design (preferred) or seed HTML.
    try {
      if (initialDesign && Object.keys(initialDesign).length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (editor as any).loadProjectData(initialDesign);
      } else if (initialHtml) {
        editor.setComponents(initialHtml);
      }
    } catch { /* fall back to empty canvas */ }

    onReady?.({
      getHtml: () => {
        // preset-newsletter registers this command → returns email-safe inlined HTML
        const inlined = editor.runCommand("gjs-get-inlined-html");
        return typeof inlined === "string" ? inlined : `${editor.getHtml()}<style>${editor.getCss()}</style>`;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getDesign: () => (editor as any).getProjectData() as object,
    });

    return () => {
      editor.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full w-full">
      <style>{THEME_CSS}</style>
      <div ref={ref} className="h-full" />
    </div>
  );
}
