"use client";

import { useRef, useState } from "react";
import { Plus, Download, Trash2, ArrowUp, ArrowDown, Copy, LayoutGrid, Loader2, Image as ImageIcon, Square, RectangleVertical, Save, FolderOpen, Type, Flame, Sparkles } from "lucide-react";
import {
  DIMS, LAYOUTS, THEMES, TEMPLATES, FONTS, DECORS, GRADIENTS, DEFAULT_SWIPE, blankSlide, newId,
  type Format, type LayoutId, type Slide, type Theme, type FontStyle, type Decor, type TextPos, type Brand,
} from "@/lib/studio/templates";
import { generateCaption, CAPTION_STYLES } from "@/lib/studio/caption";
import { compressImage } from "@/lib/studio/image";
import { SlideCanvas } from "./SlideCanvas";

const THEME_LIST: Theme[] = ["navy", "blue", "white", "mint", "ink", "alert", "sun"];

// An AI-generated "trending" template loaded from the DB.
type TrendTemplate = { id: string; name: string; description: string; tags: string[]; format: Format; trend: string; createdAt: string; slides: Omit<Slide, "id">[] };

function ScaledSlide({ slide, format, index, total, targetW, brand }: { slide: Slide; format: Format; index: number; total: number; targetW: number; brand?: Brand }) {
  const { w, h } = DIMS[format];
  const scale = targetW / w;
  return (
    <div style={{ width: targetW, height: Math.round(h * scale), overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <SlideCanvas slide={slide} format={format} index={index} total={total} brand={brand} />
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
  const [brand, setBrand] = useState<Brand>({ swipeText: DEFAULT_SWIPE });
  const [selected, setSelected] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [gallery, setGallery] = useState(false);
  const [trending, setTrending] = useState<TrendTemplate[]>([]);
  const [finding, setFinding] = useState(false);
  const exportRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fontCssRef = useRef<string | null>(null);
  const [caption, setCaption] = useState<{ open: boolean; style: number; text: string }>({ open: false, style: 0, text: "" });
  const [drafts, setDrafts] = useState<{ id: string; name: string; updatedAt: string }[]>([]);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [flash, setFlash] = useState("");
  const showFlash = (m: string) => { setFlash(m); setTimeout(() => setFlash(""), 1600); };

  const total = slides.length;
  const cur = slides[selected];

  const update = (idx: number, patch: Partial<Slide>) =>
    setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  const setField = (key: string, value: string | string[] | boolean) =>
    update(selected, { fields: { ...cur.fields, [key]: value } });

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const dataUrl = await compressImage(file);
      update(selected, { bgImage: dataUrl, overlay: cur.overlay ?? 0.5 });
    } catch {
      // Fallback: use the original if compression/decoding fails (e.g. HEIC).
      const reader = new FileReader();
      reader.onload = () => update(selected, { bgImage: reader.result as string, overlay: cur.overlay ?? 0.5 });
      reader.readAsDataURL(file);
    }
  };

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      // Keep PNG so a transparent logo stays transparent; downscale to keep drafts small.
      const dataUrl = await compressImage(file, 640, 0.92, "image/png");
      setBrand((b) => ({ ...b, logo: dataUrl }));
    } catch {
      const reader = new FileReader();
      reader.onload = () => setBrand((b) => ({ ...b, logo: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

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

  // ── AI trending templates (auto-generated, loaded from the DB) ───────────────
  const loadTrendingList = async () => {
    try {
      const res = await fetch("/api/admin/studio-templates");
      if (res.ok) setTrending((await res.json()).templates ?? []);
    } catch {}
  };
  const openGallery = () => { setGallery(true); loadTrendingList(); };
  const loadTrend = (t: TrendTemplate) => {
    if (!t.slides?.length) return;
    setFormat(t.format === "portrait" ? "portrait" : "square");
    setSlides(t.slides.map((s) => ({ ...s, id: newId() })));
    setSelected(0); setGallery(false);
  };
  const deleteTrend = async (id: string) => {
    setTrending((list) => list.filter((t) => t.id !== id));
    await fetch(`/api/admin/studio-templates/${id}`, { method: "DELETE" }).catch(() => {});
  };
  const findTrends = async () => {
    setFinding(true);
    try {
      const res = await fetch("/api/admin/studio-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        await loadTrendingList();
        showFlash(j.added ? `Added ${j.added} fresh template${j.added === 1 ? "" : "s"} ✓` : (j.message || "No new trends found"));
      } else {
        showFlash(j.error || "Trend search unavailable");
      }
    } catch { showFlash("Trend search failed"); }
    finally { setFinding(false); }
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

  // ── Caption generator ──────────────────────────────────────────────────────
  const openCaption = () => setCaption({ open: true, style: 0, text: generateCaption(slides, 0) });
  const shuffleCaption = () => setCaption((c) => { const st = c.style + 1; return { ...c, style: st, text: generateCaption(slides, st) }; });
  const copyCaption = async () => { try { await navigator.clipboard.writeText(caption.text); showFlash("Copied!"); } catch { showFlash("Copy failed"); } };

  // ── Save / open drafts ─────────────────────────────────────────────────────
  const saveDraft = async () => {
    const name = draftName || (typeof window !== "undefined" ? window.prompt("Name this design:", "Untitled carousel") : "") || "";
    if (!name.trim()) return;
    try {
      const res = await fetch("/api/admin/studio-drafts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draftId || undefined, name: name.trim(), data: { format, slides, brand } }),
      });
      if (res.ok) { const d = await res.json(); setDraftId(d.id); setDraftName(d.name); showFlash("Saved ✓"); }
      else showFlash("Save failed");
    } catch { showFlash("Save failed"); }
  };
  const openDrafts = async () => {
    try { const res = await fetch("/api/admin/studio-drafts"); if (res.ok) setDrafts((await res.json()).drafts); } catch {}
    setDraftsOpen(true);
  };
  const loadDraft = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/studio-drafts/${id}`); if (!res.ok) return;
      const { draft } = await res.json();
      const data = draft.data as { format?: Format; slides?: Slide[]; brand?: Brand };
      setFormat(data.format || "square");
      setSlides((data.slides && data.slides.length ? data.slides : slides).map((s) => ({ ...s })));
      setBrand(data.brand ?? { swipeText: DEFAULT_SWIPE });
      setSelected(0); setDraftId(draft.id); setDraftName(draft.name); setDraftsOpen(false);
    } catch {}
  };
  const deleteDraft = async (id: string) => {
    if (!confirm("Delete this saved design?")) return;
    await fetch(`/api/admin/studio-drafts/${id}`, { method: "DELETE" }).catch(() => {});
    setDrafts((d) => d.filter((x) => x.id !== id));
    if (draftId === id) { setDraftId(null); setDraftName(""); }
  };

  const previewW = format === "square" ? 460 : 400;
  const fields = LAYOUTS[cur.layout].fields;
  const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent";

  return (
    <div className="space-y-4 pb-20 lg:pb-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <button onClick={openGallery} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
            <LayoutGrid className="w-4 h-4" /> Templates
          </button>
          <button onClick={openDrafts} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
            <FolderOpen className="w-4 h-4" /> Open
          </button>
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setFormat("square")} className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${format === "square" ? "bg-navy-900 text-white" : "bg-white text-gray-600"}`}><Square className="w-4 h-4" /> Square</button>
            <button onClick={() => setFormat("portrait")} className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${format === "portrait" ? "bg-navy-900 text-white" : "bg-white text-gray-600"}`}><RectangleVertical className="w-4 h-4" /> Portrait</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {flash && <span className="text-xs font-semibold text-teal-600">{flash}</span>}
          <button onClick={openCaption} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
            <Type className="w-4 h-4" /> Caption
          </button>
          <button onClick={saveDraft} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
            <Save className="w-4 h-4" /> Save
          </button>
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
                <ScaledSlide slide={s} format={format} index={i} total={total} targetW={190} brand={brand} />
                <span className="absolute top-1 left-1 bg-black/55 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="flex flex-col items-center">
          <div className="rounded-xl shadow-lg ring-1 ring-gray-200 overflow-hidden">
            <ScaledSlide slide={cur} format={format} index={selected} total={total} targetW={previewW} brand={brand} />
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

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Text position</label>
            <div className="inline-flex mt-1.5 rounded-lg border border-gray-200 overflow-hidden w-full">
              {(["top", "center", "bottom"] as TextPos[]).map((p) => {
                const def = cur.layout === "cover" || cur.layout === "list" || cur.layout === "checklist" ? "top" : "center";
                const active = (cur.textPos ?? def) === p;
                return (
                  <button key={p} onClick={() => update(selected, { textPos: p })}
                    className={`flex-1 px-2 py-2 text-xs font-semibold capitalize ${active ? "bg-navy-900 text-white" : "bg-white text-gray-600"}`}>{p}</button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Background</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              <button onClick={() => update(selected, { gradient: undefined })} title="Theme color (no gradient)"
                className={`w-9 h-9 rounded-lg border-2 flex items-center justify-center text-sm font-bold text-gray-400 ${!cur.gradient ? "border-teal-500" : "border-gray-200"}`}
                style={{ background: THEMES[cur.theme].bg }}>—</button>
              {GRADIENTS.map((g) => (
                <button key={g.id} title={g.name} onClick={() => update(selected, { gradient: g.css })}
                  className={`w-9 h-9 rounded-lg border-2 ${cur.gradient === g.css ? "border-teal-500" : "border-gray-200"}`}
                  style={{ background: g.css }} />
              ))}
            </div>
            <span className="text-[11px] text-gray-400 block mt-2">Photo (overrides gradient):</span>
            {cur.bgImage ? (
              <div className="mt-1.5 space-y-2">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cur.bgImage} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-200" />
                  <label className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    Replace<input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
                  </label>
                  <button onClick={() => update(selected, { bgImage: undefined })} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /> Remove</button>
                </div>
                <label className="block text-xs text-gray-500">Overlay darkness ({Math.round((cur.overlay ?? 0.5) * 100)}%)
                  <input type="range" min={0.2} max={0.8} step={0.05} value={cur.overlay ?? 0.5} onChange={(e) => update(selected, { overlay: parseFloat(e.target.value) })} className="w-full accent-teal-600" />
                </label>
              </div>
            ) : (
              <label className="mt-1.5 flex items-center justify-center gap-1.5 px-3 py-3 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 cursor-pointer hover:bg-gray-50">
                <ImageIcon className="w-4 h-4" /> Upload photo
                <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
              </label>
            )}
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

          {/* Brand kit — applies to every slide */}
          <div className="pt-3 border-t border-gray-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Brand kit</span>
              <span className="text-[10px] text-gray-400">applies to all slides</span>
            </div>
            <div>
              <span className="text-[11px] text-gray-500 block mb-1">Logo</span>
              {brand.logo ? (
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={brand.logo} alt="" className="h-8 max-w-[110px] object-contain rounded bg-gray-100 border border-gray-200 px-1.5" />
                  <label className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    Replace<input type="file" accept="image/*" className="hidden" onChange={onLogo} />
                  </label>
                  <button onClick={() => setBrand((b) => ({ ...b, logo: undefined }))} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50" title="Back to default logo">Default</button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-xs text-gray-600 cursor-pointer hover:bg-gray-50">
                  <ImageIcon className="w-4 h-4" /> Upload custom logo
                  <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
                </label>
              )}
              <p className="text-[10px] text-gray-400 mt-1">Default is the DooGoodScoopers logo (auto light/dark per color). PNG with transparency works best.</p>
              <label className="block text-[11px] text-gray-500 mt-2">Logo size ({Math.round((brand.logoScale ?? 1) * 100)}%)
                <input type="range" min={0.5} max={2} step={0.05} value={brand.logoScale ?? 1}
                  onChange={(e) => setBrand((b) => ({ ...b, logoScale: parseFloat(e.target.value) }))} className="w-full accent-teal-600" />
              </label>
            </div>
            <label className="block">
              <span className="text-[11px] text-gray-500 block mb-1">Swipe label</span>
              <input className={inputCls} value={brand.swipeText ?? ""} placeholder={DEFAULT_SWIPE}
                onChange={(e) => setBrand((b) => ({ ...b, swipeText: e.target.value }))} />
              <span className="text-[10px] text-gray-400 mt-1 block">Shown bottom-left on every slide except the last. Leave blank to hide it everywhere.</span>
              <span className="block text-[11px] text-gray-500 mt-2">Swipe size ({Math.round((brand.swipeScale ?? 1) * 100)}%)
                <input type="range" min={0.5} max={2} step={0.05} value={brand.swipeScale ?? 1}
                  onChange={(e) => setBrand((b) => ({ ...b, swipeScale: parseFloat(e.target.value) }))} className="w-full accent-teal-600" />
              </span>
            </label>
          </div>

          <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={cur.showLogo} onChange={(e) => update(selected, { showLogo: e.target.checked })} className="rounded" /> Show logo <span className="text-gray-400">(this slide)</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={cur.showSwipe} onChange={(e) => update(selected, { showSwipe: e.target.checked })} className="rounded" /> Show swipe label <span className="text-gray-400">(this slide)</span>
            </label>
          </div>
          <p className="text-[11px] text-gray-400">Tip: wrap words in <code className="bg-gray-100 px-1 rounded">**stars**</code> to highlight, <code className="bg-gray-100 px-1 rounded">~~tildes~~</code> for red.</p>
        </div>
      </div>

      {/* Hidden full-size export stage */}
      <div style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none", opacity: 0 }} aria-hidden>
        {slides.map((s, i) => (
          <div key={s.id} ref={(el) => { exportRefs.current[i] = el; }}>
            <SlideCanvas slide={s} format={format} index={i} total={total} brand={brand} />
          </div>
        ))}
      </div>

      {/* Template gallery */}
      {gallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setGallery(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <h2 className="text-lg font-bold text-navy-900">Start from a template</h2>
                <p className="text-sm text-gray-500">Pick a layout set, then edit the text. This replaces the current slides.</p>
              </div>
              <button onClick={findTrends} disabled={finding}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60">
                {finding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {finding ? "Searching trends…" : "Find fresh trends"}
              </button>
            </div>

            {/* AI trending templates */}
            <div className="mt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-bold text-navy-900">Trending now</h3>
                <span className="text-[11px] text-gray-400">· auto-updated weekly by AI</span>
              </div>
              {trending.length === 0 ? (
                <p className="text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl px-3 py-4 mb-5">
                  No trending templates yet. Hit <span className="font-semibold text-orange-500">Find fresh trends</span> — the AI researches what carousel formats are popping off right now and builds a few on-brand ones for you. New batches also land automatically each week.
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4 mb-5">
                  {trending.map((t) => (
                    <div key={t.id} className="relative text-left border border-orange-200 bg-orange-50/40 rounded-xl p-3 hover:border-orange-400 hover:shadow-sm transition">
                      <button onClick={() => deleteTrend(t.id)} title="Remove" className="absolute top-2 right-2 z-10 p-1 rounded-full bg-white/90 border border-gray-200 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => loadTrend(t)} className="block w-full text-left">
                        <div className="flex gap-1.5 mb-2 overflow-hidden rounded-md">
                          {t.slides.slice(0, 4).map((s, i) => (
                            <ScaledSlide key={i} slide={{ ...s, id: `tr${i}` }} format={t.format} index={i} total={t.slides.length} targetW={78} brand={brand} />
                          ))}
                        </div>
                        <p className="font-semibold text-navy-900 text-sm">{t.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                        {t.trend && <p className="text-[11px] text-orange-600 mt-1 flex items-start gap-1"><Flame className="w-3 h-3 mt-0.5 shrink-0" /><span>{t.trend}</span></p>}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 mb-2 pt-1 border-t border-gray-100">
              <LayoutGrid className="w-4 h-4 text-gray-400 mt-2" />
              <h3 className="text-sm font-bold text-navy-900 mt-2">Core templates</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => loadTemplate(t.id)} className="text-left border border-gray-200 rounded-xl p-3 hover:border-teal-400 hover:shadow-sm transition">
                  <div className="flex gap-1.5 mb-2 overflow-hidden rounded-md">
                    {t.slides.slice(0, 4).map((s, i) => (
                      <ScaledSlide key={i} slide={{ ...s, id: `t${i}` }} format="square" index={i} total={t.slides.length} targetW={78} brand={brand} />
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

      {/* Caption generator */}
      {caption.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setCaption((c) => ({ ...c, open: false }))}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-navy-900">Caption</h2>
              <span className="text-xs text-gray-400">Style: {CAPTION_STYLES[caption.style % CAPTION_STYLES.length]}</span>
            </div>
            <p className="text-sm text-gray-500 mb-3">Auto-written from your slides. Edit freely, then copy & paste into Instagram.</p>
            <textarea rows={12} value={caption.text} onChange={(e) => setCaption((c) => ({ ...c, text: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
            <div className="flex items-center gap-2 mt-3">
              <button onClick={copyCaption} className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700"><Copy className="w-4 h-4" /> Copy</button>
              <button onClick={shuffleCaption} className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Shuffle style</button>
              {flash && <span className="text-xs font-semibold text-teal-600">{flash}</span>}
              <button onClick={() => setCaption((c) => ({ ...c, open: false }))} className="ml-auto px-3 py-2 text-sm text-gray-500">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Saved drafts */}
      {draftsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDraftsOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-navy-900 mb-1">Saved designs</h2>
            <p className="text-sm text-gray-500 mb-4">Open a saved carousel to keep editing.</p>
            {drafts.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">No saved designs yet. Hit “Save” to create one.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {drafts.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 py-2.5">
                    <button onClick={() => loadDraft(d.id)} className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-navy-900 truncate">{d.name}{draftId === d.id ? " (open)" : ""}</p>
                      <p className="text-xs text-gray-400" suppressHydrationWarning>{new Date(d.updatedAt).toLocaleString()}</p>
                    </button>
                    <button onClick={() => deleteDraft(d.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
