"use client";

import { useRef, useState } from "react";
import { Plus, Download, Trash2, ArrowUp, ArrowDown, Copy, LayoutGrid, Loader2, Image as ImageIcon, Square, RectangleVertical } from "lucide-react";
import {
  DIMS, LAYOUTS, THEMES, TEMPLATES, FONTS, DECORS, blankSlide, newId,
  type Format, type LayoutId, type Slide, type Theme, type FontStyle, type Decor,
} from "@/lib/studio/templates";
import { SlideCanvas } from "./SlideCanvas";

const THEME_LIST: Theme[] = ["navy", "blue", "white", "mint", "ink", "alert", "sun"];

function ScaledSlide({ slide, format, index, total, targetW }: { slide: Slide; format: Format; index: number; total: number; targetW: number }) {
  const { w, h } = DIMS[format];
  const scale = targetW / w;
  return (
    <div style={{ width: targetW, height: Math.round(h * scale), overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <SlideCanvas slide={slide} format={format} index={index} total={total} />
      </div>
    </div>
  );
}

function triggerDownload(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove();
}

export function StudioApp() {
  const [format, setFormat] = useState<Format>("square");
  const [slides, setSlides] = useState<Slide[]>(() => TEMPLATES[0].slides.map((s) => ({ ...s, id: newId() })));
  const [selected, setSelected] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [gallery, setGallery] = useState(false);
  const exportRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fontCssRef = useRef<string | null>(null);

  const total = slides.length;
  const cur = slides[selected];

  const update = (idx: number, patch: Partial<Slide>) =>
    setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  const setField = (key: string, value: string | string[] | boolean) =>
    update(selected, { fields: { ...cur.fields, [key]: value } });

  const addSlide = (layout: LayoutId) => {
    const ns = blankSlide(layout, cur?.theme ?? "white");
    setSlides((prev) => { const n = [...prev]; n.splice(selected + 1, 0, ns); return n; });
    setSelected((i) => i + 1);
  };
  const duplicate = () => {
    setSlides((prev) => { const n = [...prev]; n.splice(selected + 1, 0, { ...cur, id: newId() }); return n; });
    setSelected((i) => i + 1);
  };
  const remove = (idx: number) => {
    if (slides.length <= 1) return;
    setSlides((prev) => prev.filter((_, i) => i !== idx));
    setSelected((i) => Math.max(0, Math.min(i, slides.length - 2)));
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir; if (j < 0 || j >= slides.length) return;
    setSlides((prev) => { const n = [...prev]; [n[idx], n[j]] = [n[j], n[idx]]; return n; });
    setSelected(j);
  };
  const loadTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id); if (!t) return;
    setSlides(t.slides.map((s) => ({ ...s, id: newId() })));
    setSelected(0); setGallery(false);
  };

  async function exportImages(all: boolean) {
    setExporting(true);
    try {
      // Ensure webfonts are ready so text renders in Montserrat, not a fallback.
      if (typeof document !== "undefined" && (document as unknown as { fonts?: FontFaceSet }).fonts) {
        await (document as unknown as { fonts: FontFaceSet }).fonts.ready;
      }
      const { toPng } = await import("html-to-image");
      // Guarantee Montserrat in the exported PNG by feeding html-to-image the
      // fully self-hosted @font-face CSS (embedding next/font can be flaky).
      if (fontCssRef.current === null) {
        try { fontCssRef.current = await (await fetch("/studio-fonts.css")).text(); }
        catch { fontCssRef.current = ""; }
      }
      const { w, h } = DIMS[format];
      const opts = { width: w, height: h, pixelRatio: 1, cacheBust: true, fontEmbedCSS: fontCssRef.current || undefined };
      const idxs = all ? slides.map((_, i) => i) : [selected];
      if (all) {
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        for (const i of idxs) {
          const node = exportRefs.current[i];
          if (!node) continue;
          const dataUrl = await toPng(node, opts);
          zip.file(`slide-${String(i + 1).padStart(2, "0")}.png`, dataUrl.split(",")[1], { base64: true });
        }
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        triggerDownload(url, `doogood-carousel-${format}.zip`);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      } else {
        const node = exportRefs.current[selected];
        if (node) triggerDownload(await toPng(node, opts), `slide-${selected + 1}-${format}.png`);
      }
    } catch (e) {
      console.error("[studio] export failed", e);
      alert("Export failed — please try again.");
    } finally {
      setExporting(false);
    }
  }

  const previewW = format === "square" ? 460 : 400;
  const fields = LAYOUTS[cur.layout].fields;
  const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent";

  return (
    <div className="space-y-4 pb-20 lg:pb-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setGallery(true)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
            <LayoutGrid className="w-4 h-4" /> Templates
          </button>
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setFormat("square")} className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${format === "square" ? "bg-navy-900 text-white" : "bg-white text-gray-600"}`}><Square className="w-4 h-4" /> Square</button>
            <button onClick={() => setFormat("portrait")} className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${format === "portrait" ? "bg-navy-900 text-white" : "bg-white text-gray-600"}`}><RectangleVertical className="w-4 h-4" /> Portrait</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportImages(false)} disabled={exporting} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
            <ImageIcon className="w-4 h-4" /> This slide
          </button>
          <button onClick={() => exportImages(true)} disabled={exporting} className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download all ({total})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[210px_1fr_320px] gap-5">
        {/* Filmstrip */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Slides</span>
            <div className="relative group">
              <button className="p-1 rounded hover:bg-gray-100"><Plus className="w-4 h-4 text-gray-600" /></button>
              <div className="absolute right-0 z-20 mt-1 hidden group-hover:block bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-44">
                {(Object.keys(LAYOUTS) as LayoutId[]).map((lid) => (
                  <button key={lid} onClick={() => addSlide(lid)} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50">
                    <span className="font-medium">{LAYOUTS[lid].name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {slides.map((s, i) => (
              <div key={s.id} onClick={() => setSelected(i)} className={`relative rounded-lg overflow-hidden border-2 cursor-pointer ${i === selected ? "border-teal-500" : "border-transparent hover:border-gray-200"}`}>
                <ScaledSlide slide={s} format={format} index={i} total={total} targetW={190} />
                <span className="absolute top-1 left-1 bg-black/55 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="flex flex-col items-center">
          <div className="rounded-xl shadow-lg ring-1 ring-gray-200 overflow-hidden">
            <ScaledSlide slide={cur} format={format} index={selected} total={total} targetW={previewW} />
          </div>
          <div className="flex items-center gap-1 mt-3">
            <button onClick={() => move(selected, -1)} disabled={selected === 0} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40" title="Move up"><ArrowUp className="w-4 h-4" /></button>
            <button onClick={() => move(selected, 1)} disabled={selected === total - 1} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40" title="Move down"><ArrowDown className="w-4 h-4" /></button>
            <button onClick={duplicate} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50" title="Duplicate"><Copy className="w-4 h-4" /></button>
            <button onClick={() => remove(selected)} disabled={total <= 1} className="p-2 border border-gray-200 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40" title="Delete"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Editor */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Layout</label>
            <select value={cur.layout} onChange={(e) => update(selected, { layout: e.target.value as LayoutId, fields: blankSlide(e.target.value as LayoutId, cur.theme).fields })} className={inputCls + " mt-1 bg-white"}>
              {(Object.keys(LAYOUTS) as LayoutId[]).map((lid) => <option key={lid} value={lid}>{LAYOUTS[lid].name}</option>)}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">{LAYOUTS[cur.layout].hint}</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Color</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {THEME_LIST.map((th) => (
                <button key={th} onClick={() => update(selected, { theme: th })} title={th}
                  className={`w-9 h-9 rounded-lg border-2 ${cur.theme === th ? "border-teal-500" : "border-gray-200"}`}
                  style={{ background: THEMES[th].bg }} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Font</label>
              <div className="inline-flex mt-1.5 rounded-lg border border-gray-200 overflow-hidden w-full">
                {FONTS.map((ft) => (
                  <button key={ft.id} onClick={() => update(selected, { font: ft.id as FontStyle })}
                    className={`flex-1 px-2 py-2 text-xs font-semibold ${cur.font === ft.id ? "bg-navy-900 text-white" : "bg-white text-gray-600"}`}>
                    {ft.id === "display" ? "Bold" : "Clean"}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Decoration</span>
              <select value={cur.decor} onChange={(e) => update(selected, { decor: e.target.value as Decor })} className={inputCls + " mt-1.5 bg-white"}>
                {DECORS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </label>
          </div>

          {fields.map((fd) => {
            const val = cur.fields[fd.key];
            if (fd.type === "toggle") {
              return (
                <label key={fd.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={val === true} onChange={(e) => setField(fd.key, e.target.checked)} className="rounded" />
                  {fd.label}
                </label>
              );
            }
            return (
              <label key={fd.key} className="block">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{fd.label}</span>
                {fd.type === "text" ? (
                  <input className={inputCls + " mt-1"} value={typeof val === "string" ? val : ""} placeholder={fd.placeholder} onChange={(e) => setField(fd.key, e.target.value)} />
                ) : (
                  <textarea rows={fd.type === "list" ? 6 : 3} className={inputCls + " mt-1 resize-none"} placeholder={fd.placeholder}
                    value={fd.type === "list" ? (Array.isArray(val) ? val.join("\n") : "") : (typeof val === "string" ? val : "")}
                    onChange={(e) => setField(fd.key, fd.type === "list" ? e.target.value.split("\n") : e.target.value)} />
                )}
              </label>
            );
          })}

          <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={cur.showLogo} onChange={(e) => update(selected, { showLogo: e.target.checked })} className="rounded" /> Show logo
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={cur.showSwipe} onChange={(e) => update(selected, { showSwipe: e.target.checked })} className="rounded" /> Show “SWIPE →” (hidden on last slide)
            </label>
          </div>
          <p className="text-[11px] text-gray-400">Tip: wrap words in <code className="bg-gray-100 px-1 rounded">**stars**</code> to highlight, <code className="bg-gray-100 px-1 rounded">~~tildes~~</code> for red.</p>
        </div>
      </div>

      {/* Hidden full-size export stage */}
      <div style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none", opacity: 0 }} aria-hidden>
        {slides.map((s, i) => (
          <div key={s.id} ref={(el) => { exportRefs.current[i] = el; }}>
            <SlideCanvas slide={s} format={format} index={i} total={total} />
          </div>
        ))}
      </div>

      {/* Template gallery */}
      {gallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setGallery(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-navy-900 mb-1">Start from a template</h2>
            <p className="text-sm text-gray-500 mb-4">Pick a layout set, then edit the text. This replaces the current slides.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => loadTemplate(t.id)} className="text-left border border-gray-200 rounded-xl p-3 hover:border-teal-400 hover:shadow-sm transition">
                  <div className="flex gap-1.5 mb-2 overflow-hidden rounded-md">
                    {t.slides.slice(0, 4).map((s, i) => (
                      <ScaledSlide key={i} slide={{ ...s, id: `t${i}` }} format="square" index={i} total={t.slides.length} targetW={78} />
                    ))}
                  </div>
                  <p className="font-semibold text-navy-900 text-sm">{t.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
