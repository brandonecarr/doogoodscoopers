"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GripVertical, Plus, Trash2, Save, Eye, EyeOff, ExternalLink, Loader2, Rocket, Palette, Layout,
} from "lucide-react";
import type { FunnelData, Step, StepLayout, Block, BlockType, BlockStyle, ContactField } from "@/lib/funnel/types";
import { SECTION_TEMPLATES } from "@/lib/funnel/templates";
import { FunnelRunner } from "@/components/funnel/FunnelRunner";

function reorder<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [m] = copy.splice(from, 1);
  copy.splice(to, 0, m);
  return copy;
}
const uid = (p: string) => `${p}${Math.random().toString(36).slice(2, 7)}`;

const BLOCK_TYPES: { type: BlockType; label: string }[] = [
  { type: "heading", label: "Heading" },
  { type: "text", label: "Text" },
  { type: "image", label: "Image" },
  { type: "zipCheck", label: "ZIP check" },
  { type: "choice", label: "Choice (buttons)" },
  { type: "priceEstimate", label: "Price estimate" },
  { type: "contactForm", label: "Contact form" },
  { type: "cta", label: "Button / CTA" },
  { type: "video", label: "Video" },
  { type: "testimonial", label: "Testimonial" },
  { type: "rating", label: "Star rating" },
  { type: "trustBadges", label: "Trust badges" },
  { type: "divider", label: "Divider" },
  { type: "spacer", label: "Spacer" },
  { type: "html", label: "Custom HTML" },
];
const CONTACT_FIELDS: ContactField[] = ["firstName", "lastName", "email", "phone", "address"];

export function FunnelBuilder({ initial }: { initial: { id: string; name: string; slug: string; status: string; data: FunnelData } }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [status, setStatus] = useState(initial.status);
  const [data, setData] = useState<FunnelData>(initial.data);
  const [selId, setSelId] = useState(initial.data.variants.A.steps[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  const dragStep = useRef<number | null>(null);
  const dragBlock = useRef<number | null>(null);

  const [av, setAv] = useState<"A" | "B">("A");
  const steps = (av === "B" ? data.variants.B?.steps : data.variants.A.steps) || [];
  const sel = steps.find((s) => s.id === selId) || steps[0];

  const setSteps = (next: Step[]) =>
    setData((d) => ({ ...d, variants: { ...d.variants, [av]: { steps: next } } }));

  const switchVariant = (v: "A" | "B") => { setAv(v); const s = (v === "B" ? data.variants.B?.steps : data.variants.A.steps) || []; setSelId(s[0]?.id ?? ""); };
  const createB = () => { setData((d) => ({ ...d, variants: { ...d.variants, B: JSON.parse(JSON.stringify(d.variants.A)) }, split: d.split || 50 })); setAv("B"); };
  const deleteB = () => { if (!confirm("Delete variant B? Its edits are lost.")) return; setData((d) => ({ ...d, variants: { A: d.variants.A }, split: 0 })); setAv("A"); setSelId(data.variants.A.steps[0]?.id ?? ""); };
  const patchStep = (id: string, patch: Partial<Step>) =>
    setSteps(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const patchBlock = (stepId: string, blockId: string, patch: Partial<Block>) =>
    setSteps(steps.map((s) => s.id !== stepId ? s : { ...s, blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)) }));

  const addStep = () => {
    const s: Step = { id: uid("s"), name: "New step", blocks: [{ id: uid("h"), type: "heading", text: "New step" }] };
    setSteps([...steps, s]); setSelId(s.id);
  };
  const delStep = (id: string) => {
    if (steps.length <= 1) return;
    const next = steps.filter((s) => s.id !== id);
    setSteps(next); if (selId === id) setSelId(next[0].id);
  };
  const addTemplate = (key: string) => {
    const tpl = SECTION_TEMPLATES.find((t) => t.key === key);
    if (!tpl) return;
    const s = tpl.make();
    const at = steps.findIndex((x) => x.id === selId);
    const next = at < 0 ? [...steps, s] : [...steps.slice(0, at + 1), s, ...steps.slice(at + 1)];
    setSteps(next); setSelId(s.id);
  };
  const addBlock = (type: BlockType) => {
    if (!sel) return;
    const base: Block = { id: uid("b"), type };
    if (type === "choice") { base.field = "numberOfDogs"; base.options = [{ value: "1", label: "1 dog" }, { value: "2", label: "2 dogs" }]; }
    if (type === "contactForm") base.fields = ["firstName", "phone", "email"];
    if (type === "cta") { base.ctaKind = "next"; base.label = "Continue"; }
    if (type === "heading") base.text = "Heading";
    if (type === "text") base.text = "Some text";
    if (type === "zipCheck") base.label = "Check my area";
    if (type === "html") base.html = '<div style="padding:8px;text-align:center">Your custom HTML</div>';
    if (type === "video") base.videoUrl = "";
    if (type === "testimonial") { base.quote = "They show up every week and my yard has never looked better."; base.authorName = "Happy customer"; base.authorMeta = "Fontana, CA"; base.rating = 5; }
    if (type === "rating") { base.rating = 5; base.ratingCount = "Loved by Inland Empire dog owners"; }
    if (type === "trustBadges") base.items = [{ icon: "🛡️", label: "Licensed & insured" }, { icon: "📍", label: "Locally owned" }, { icon: "↩️", label: "Cancel anytime" }];
    if (type === "spacer") base.size = 16;
    patchStep(sel.id, { blocks: [...sel.blocks, base] });
  };

  const save = async (publish?: boolean) => {
    setSaving(true); setMsg("");
    const newStatus = publish === undefined ? status : publish ? "published" : "draft";
    try {
      const res = await fetch("/api/admin/funnels", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: initial.id, name, slug, status: newStatus, data }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(d.error || "Couldn't save."); return; }
      setStatus(newStatus); if (d.slug) setSlug(d.slug);
      setMsg("Saved ✓"); setTimeout(() => setMsg(""), 1600);
      router.refresh();
    } catch { setMsg("Something went wrong."); } finally { setSaving(false); }
  };

  const previewData = useMemo(() => data, [data]);

  return (
    <div className="space-y-3.5">
      {/* Top bar */}
      <div className="dgs-card p-3 flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 min-w-[160px] px-3 py-2 text-[14px] font-bold border border-gray-200 rounded-lg" />
        <div className="flex items-center gap-1 text-[12px] text-gray-500">/f/<input value={slug} onChange={(e) => setSlug(e.target.value)} className="w-32 px-2 py-1.5 border border-gray-200 rounded-lg text-gray-800" /></div>
        <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${status === "published" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>{status}</span>
        <button onClick={() => setShowPreview((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold text-gray-600 border border-gray-200">
          {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} Preview
        </button>
        <a href={`/f/${slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold text-gray-600 border border-gray-200"><ExternalLink className="w-4 h-4" /> Live</a>
        <button onClick={() => save()} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold text-white" style={{ background: "#101014" }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
        </button>
        <button onClick={() => save(status !== "published")} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold text-white" style={{ background: "#6D3EF0" }}>
          <Rocket className="w-4 h-4" /> {status === "published" ? "Unpublish" : "Publish"}
        </button>
        {msg && <span className="text-[12px] text-gray-500">{msg}</span>}
      </div>

      {/* A/B variants */}
      <div className="dgs-card p-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-bold text-ink uppercase tracking-wide mr-1">Variant</span>
        <button onClick={() => switchVariant("A")} className="px-3 py-1.5 rounded-lg text-[12.5px] font-bold" style={av === "A" ? { background: "#6D3EF0", color: "#fff" } : { background: "#F4F4F6", color: "#5A5A66" }}>A</button>
        {data.variants.B ? (
          <>
            <button onClick={() => switchVariant("B")} className="px-3 py-1.5 rounded-lg text-[12.5px] font-bold" style={av === "B" ? { background: "#6D3EF0", color: "#fff" } : { background: "#F4F4F6", color: "#5A5A66" }}>B</button>
            <div className="flex items-center gap-1.5 text-[12px] text-gray-500 ml-1">
              Split
              <input type="number" min={0} max={100} value={data.split ?? 50} onChange={(e) => setData((d) => ({ ...d, split: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }))} className="w-16 px-2 py-1 border border-gray-200 rounded-lg" />
              % to B
            </div>
            <button onClick={deleteB} className="text-[12px] text-rose-500 font-semibold ml-auto">Delete B</button>
          </>
        ) : (
          <button onClick={createB} className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold text-violet-600 border border-violet-200">+ Add B variant (A/B test)</button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_360px] gap-3.5">
        {/* Steps */}
        <div className="dgs-card p-2.5 h-fit">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[12px] font-bold text-ink uppercase tracking-wide">Steps</span>
            <button onClick={addStep} className="p-1 rounded hover:bg-gray-100 text-violet-600"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="space-y-1">
            {steps.map((s, i) => (
              <div key={s.id} draggable
                onDragStart={() => (dragStep.current = i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragStep.current != null) { setSteps(reorder(steps, dragStep.current, i)); dragStep.current = null; } }}
                onClick={() => setSelId(s.id)}
                className="flex items-center gap-1.5 px-2 py-2 rounded-lg cursor-pointer text-[13px]"
                style={s.id === selId ? { background: "#EFE9FF", color: "#6D3EF0", fontWeight: 700 } : { color: "#374151" }}>
                <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                <span className="flex-1 truncate">{s.name}</span>
                {steps.length > 1 && <button onClick={(e) => { e.stopPropagation(); delStep(s.id); }} className="text-gray-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            ))}
          </div>
          <select onChange={(e) => { if (e.target.value) { addTemplate(e.target.value); e.target.value = ""; } }} defaultValue=""
            className="w-full mt-2 text-[12px] border border-violet-200 text-violet-700 font-semibold rounded-lg px-2 py-1.5 bg-violet-50/40">
            <option value="">+ Add screen from template…</option>
            {["Opening", "Questions", "Persuasion", "Convert"].map((g) => (
              <optgroup key={g} label={g}>
                {SECTION_TEMPLATES.filter((t) => t.group === g).map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="text-[10.5px] text-gray-400 mt-1 px-1">Inserts a ready-made screen after the selected step — then restyle it.</p>
        </div>

        {/* Step editor */}
        <div className="space-y-3">
          {sel && (
            <>
              <div className="dgs-card p-4">
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Step name</label>
                <input value={sel.name} onChange={(e) => patchStep(sel.id, { name: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              </div>

              <LayoutPanel step={sel} onChange={(layout) => patchStep(sel.id, { layout })} />

              <div className="dgs-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-bold text-ink uppercase tracking-wide">Blocks</span>
                  <select onChange={(e) => { if (e.target.value) { addBlock(e.target.value as BlockType); e.target.value = ""; } }} defaultValue="" className="text-[12px] border border-gray-200 rounded-lg px-2 py-1.5">
                    <option value="">+ Add block…</option>
                    {BLOCK_TYPES.map((b) => <option key={b.type} value={b.type}>{b.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  {sel.blocks.map((b, i) => (
                    <div key={b.id} draggable
                      onDragStart={() => (dragBlock.current = i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => { if (dragBlock.current != null) { patchStep(sel.id, { blocks: reorder(sel.blocks, dragBlock.current, i) }); dragBlock.current = null; } }}
                      className="border border-gray-200 rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab" />
                        <span className="text-[11px] font-bold text-gray-500 uppercase flex-1">{b.type}</span>
                        <button onClick={() => patchStep(sel.id, { blocks: sel.blocks.filter((x) => x.id !== b.id) })} className="text-gray-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <BlockEditor block={b} onChange={(patch) => patchBlock(sel.id, b.id, patch)} />
                      <StylePanel style={b.style} onChange={(patch) => patchBlock(sel.id, b.id, patch)} />
                    </div>
                  ))}
                </div>
              </div>

              <BranchEditor step={sel} steps={steps} onChange={(logic) => patchStep(sel.id, { logic })} />
            </>
          )}

          {/* Brand & design */}
          <div className="dgs-card p-4 space-y-3">
            <h3 className="text-[12px] font-bold text-ink uppercase tracking-wide">Brand &amp; design</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "primary" as const, label: "Accent", def: "#6D3EF0" },
                { key: "bg" as const, label: "Page bg", def: "#0E2A47" },
                { key: "cardBg" as const, label: "Card bg", def: "#ffffff" },
              ].map((c) => (
                <label key={c.key} className="block">
                  <span className="block text-[11px] font-semibold text-gray-500 mb-1">{c.label}</span>
                  <input type="color" value={data.theme?.[c.key] || c.def} onChange={(e) => setData((d) => ({ ...d, theme: { ...d.theme, [c.key]: e.target.value } }))} className="h-9 w-full rounded-lg border border-gray-200" />
                </label>
              ))}
            </div>
            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-500 mb-1">Font (Google Fonts family, e.g. Poppins)</span>
              <input value={data.theme?.fontFamily || ""} onChange={(e) => setData((d) => ({ ...d, theme: { ...d.theme, fontFamily: e.target.value } }))} placeholder="Inter" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-500 mb-1">Booking handoff URL (Sweep&amp;Go)</span>
              <input value={data.settings?.bookingUrl || ""} onChange={(e) => setData((d) => ({ ...d, settings: { ...d.settings, bookingUrl: e.target.value } }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-500 mb-1">Custom CSS (the escape hatch)</span>
              <textarea rows={5} value={data.settings?.customCss || ""} onChange={(e) => setData((d) => ({ ...d, settings: { ...d.settings, customCss: e.target.value } }))} placeholder=".dgs-funnel-card { border-radius: 24px; }" className="w-full px-3 py-2 text-[12px] font-mono border border-gray-200 rounded-lg" />
              <span className="block text-[11px] text-gray-400 mt-1">Target <code>.dgs-funnel-card</code> / <code>.dgs-funnel-blocks</code>. For full custom markup, add a <b>Custom HTML</b> block.</span>
            </label>
          </div>
        </div>

        {/* Live preview */}
        {showPreview && (
          <div className="dgs-card p-2 h-fit lg:sticky lg:top-[92px] overflow-hidden">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide px-2 py-1">Live preview</div>
            <div className="rounded-xl overflow-hidden border border-gray-100" style={{ height: 560 }}>
              <div className="scale-[0.72] origin-top-left" style={{ width: "139%", height: "139%" }}>
                <FunnelRunner key={`${av}-${JSON.stringify(previewData).length}`} funnelId={initial.id} slug={slug} data={previewData} preview forceVariant={av} previewStepId={selId} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BlockEditor({ block, onChange }: { block: Block; onChange: (patch: Partial<Block>) => void }) {
  const input = "w-full px-2.5 py-1.5 text-[13px] border border-gray-200 rounded-lg";
  switch (block.type) {
    case "heading":
    case "text":
      return <textarea rows={2} value={block.text || ""} onChange={(e) => onChange({ text: e.target.value })} className={`${input} resize-none`} />;
    case "image":
      return (
        <div className="space-y-1.5">
          <input value={block.imageUrl || ""} onChange={(e) => onChange({ imageUrl: e.target.value })} placeholder="Image URL" className={input} />
          <input value={block.alt || ""} onChange={(e) => onChange({ alt: e.target.value })} placeholder="Alt text (accessibility)" className={input} />
        </div>
      );
    case "video":
      return (
        <div className="space-y-1">
          <input value={block.videoUrl || ""} onChange={(e) => onChange({ videoUrl: e.target.value })} placeholder="YouTube / Vimeo / .mp4 URL" className={input} />
          <p className="text-[11px] text-gray-400">Paste a YouTube or Vimeo link, or a direct video file URL.</p>
        </div>
      );
    case "rating":
      return (
        <div className="flex gap-2">
          <label className="text-[11px] text-gray-500 w-20">Stars
            <input type="number" min={0} max={5} step={0.5} value={block.rating ?? 5} onChange={(e) => onChange({ rating: Math.max(0, Math.min(5, parseFloat(e.target.value) || 0)) })} className={input} />
          </label>
          <label className="text-[11px] text-gray-500 flex-1">Caption
            <input value={block.ratingCount || ""} onChange={(e) => onChange({ ratingCount: e.target.value })} placeholder="200+ happy dog owners" className={input} />
          </label>
        </div>
      );
    case "testimonial":
      return (
        <div className="space-y-1.5">
          <textarea rows={2} value={block.quote || ""} onChange={(e) => onChange({ quote: e.target.value })} placeholder="Quote" className={`${input} resize-none`} />
          <div className="flex gap-1.5">
            <input value={block.authorName || ""} onChange={(e) => onChange({ authorName: e.target.value })} placeholder="Name" className={input} />
            <input value={block.authorMeta || ""} onChange={(e) => onChange({ authorMeta: e.target.value })} placeholder="City / detail" className={input} />
          </div>
          <div className="flex gap-1.5">
            <input value={block.avatarUrl || ""} onChange={(e) => onChange({ avatarUrl: e.target.value })} placeholder="Avatar URL (optional)" className={input} />
            <input type="number" min={0} max={5} step={0.5} value={block.rating ?? 5} onChange={(e) => onChange({ rating: Math.max(0, Math.min(5, parseFloat(e.target.value) || 0)) })} placeholder="Stars" className={`${input} w-20`} />
          </div>
        </div>
      );
    case "trustBadges":
      return (
        <div className="space-y-1.5">
          {(block.items || []).map((it, i) => (
            <div key={i} className="flex gap-1">
              <input value={it.icon || ""} onChange={(e) => onChange({ items: (block.items || []).map((x, j) => j === i ? { ...x, icon: e.target.value } : x) })} placeholder="🛡️" className={`${input} w-14 text-center`} />
              <input value={it.label} onChange={(e) => onChange({ items: (block.items || []).map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} placeholder="Licensed & insured" className={input} />
              <button onClick={() => onChange({ items: (block.items || []).filter((_, j) => j !== i) })} className="text-gray-300 hover:text-rose-500 px-1"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <button onClick={() => onChange({ items: [...(block.items || []), { icon: "", label: "" }] })} className="text-[12px] text-violet-600 font-semibold">+ Add badge</button>
        </div>
      );
    case "spacer":
      return (
        <label className="text-[11px] text-gray-500 block">Height (px)
          <input type="number" min={0} value={block.size ?? 16} onChange={(e) => onChange({ size: Math.max(0, parseInt(e.target.value) || 0) })} className={input} />
        </label>
      );
    case "divider":
      return <p className="text-[12px] text-gray-400">A thin horizontal line. Style its color/spacing below.</p>;
    case "zipCheck":
      return <input value={block.label || ""} onChange={(e) => onChange({ label: e.target.value })} placeholder="Button label" className={input} />;
    case "priceEstimate":
      return <p className="text-[12px] text-gray-400">Shows the live Sweep&amp;Go estimate from the ZIP + answers.</p>;
    case "html":
      return <textarea rows={5} value={block.html || ""} onChange={(e) => onChange({ html: e.target.value })} placeholder="<div>Your HTML…</div>" className={`${input} font-mono text-[12px]`} />;
    case "contactForm":
      return (
        <div className="flex flex-wrap gap-2">
          {CONTACT_FIELDS.map((f) => {
            const on = (block.fields || []).includes(f);
            return (
              <button key={f} onClick={() => onChange({ fields: on ? (block.fields || []).filter((x) => x !== f) : [...(block.fields || []), f] })}
                className="px-2 py-1 rounded-full text-[12px] font-semibold border" style={on ? { background: "#EFE9FF", color: "#6D3EF0", borderColor: "#6D3EF0" } : { color: "#6B7280", borderColor: "#E5E7EB" }}>{f}</button>
            );
          })}
        </div>
      );
    case "cta":
      return (
        <div className="space-y-1.5">
          <input value={block.label || ""} onChange={(e) => onChange({ label: e.target.value })} placeholder="Button label" className={input} />
          <select value={block.ctaKind || "next"} onChange={(e) => onChange({ ctaKind: e.target.value as Block["ctaKind"] })} className={input}>
            <option value="next">Go to next step</option>
            <option value="submit">Submit the lead</option>
            <option value="booking">Booking handoff (Sweep&amp;Go)</option>
            <option value="link">External link</option>
          </select>
          {block.ctaKind === "link" && <input value={block.href || ""} onChange={(e) => onChange({ href: e.target.value })} placeholder="https://…" className={input} />}
        </div>
      );
    case "choice":
      return (
        <div className="space-y-1.5">
          <label className="block text-[11px] text-gray-500">Answer key
            <select value={block.field || "numberOfDogs"} onChange={(e) => onChange({ field: e.target.value })} className={input}>
              <option value="numberOfDogs">numberOfDogs</option>
              <option value="frequency">frequency</option>
              <option value="lastCleaned">lastCleaned</option>
            </select>
          </label>
          {(block.options || []).map((o, i) => (
            <div key={i} className="flex gap-1">
              <input value={o.value} onChange={(e) => onChange({ options: (block.options || []).map((x, j) => j === i ? { ...x, value: e.target.value } : x) })} placeholder="value" className={`${input} w-24`} />
              <input value={o.label} onChange={(e) => onChange({ options: (block.options || []).map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} placeholder="label" className={input} />
              <button onClick={() => onChange({ options: (block.options || []).filter((_, j) => j !== i) })} className="text-gray-300 hover:text-rose-500 px-1"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <button onClick={() => onChange({ options: [...(block.options || []), { value: "", label: "" }] })} className="text-[12px] text-violet-600 font-semibold">+ Add option</button>
        </div>
      );
    default:
      return null;
  }
}

/** A color control with an explicit "None (transparent)" state — native color
 *  inputs can't be transparent, so we clear the value instead. Touching the
 *  swatch always turns a color ON (clears None); the None button always clears
 *  to transparent. The two states are mutually exclusive and never both active. */
function ColorField({ label, value, def, onChange }: { label: string; value?: string; def: string; onChange: (v?: string) => void }) {
  const isColor = /^#/.test(value || "");
  const none = !value;
  return (
    <div className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide">
      {label}
      <div className="flex items-center gap-1 mt-1">
        <input type="color" value={isColor ? value : def}
          onClick={() => { if (none) onChange(def); }}   // opening the picker turns a color on
          onChange={(e) => onChange(e.target.value)}
          title="Pick a color"
          className={`h-7 w-8 rounded border border-gray-200 p-0 shrink-0 cursor-pointer ${none ? "opacity-40" : ""}`} />
        <button type="button" onClick={() => onChange(undefined)} title="No fill (transparent)"
          className="h-7 px-1.5 rounded border text-[10px] font-bold leading-none shrink-0"
          style={none ? { borderColor: "#6D3EF0", color: "#6D3EF0", background: "#EFE9FF" } : { borderColor: "#E5E7EB", color: "#9CA3AF", background: "#fff" }}>
          None
        </button>
      </div>
    </div>
  );
}

function LayoutPanel({ step, onChange }: { step: Step; onChange: (layout: StepLayout) => void }) {
  const L = step.layout || {};
  const set = (patch: Partial<StepLayout>) => onChange({ ...L, ...patch });
  const num = (v: string) => (v === "" ? undefined : Math.max(0, parseInt(v) || 0));
  const cell = "text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide";
  const ipt = "w-full mt-1 px-2 py-1 text-[12px] border border-gray-200 rounded-md";
  const seg = (active: boolean) => active ? { background: "#EFE9FF", color: "#6D3EF0", borderColor: "#6D3EF0" } : { color: "#6B7280", borderColor: "#E5E7EB" };
  const full = L.mode === "full";
  return (
    <div className="dgs-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Layout className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-[12px] font-bold text-ink uppercase tracking-wide">Screen layout</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className={cell}>Container
          <div className="flex gap-1 mt-1">
            <button type="button" onClick={() => set({ mode: "card" })} className="flex-1 py-1.5 rounded-md border text-[11px] font-bold" style={seg(!full)}>Card</button>
            <button type="button" onClick={() => set({ mode: "full" })} className="flex-1 py-1.5 rounded-md border text-[11px] font-bold" style={seg(full)}>Full-bleed</button>
          </div>
        </div>
        <div className={cell}>Vertical
          <div className="flex gap-1 mt-1">
            <button type="button" onClick={() => set({ vAlign: "center" })} className="flex-1 py-1.5 rounded-md border text-[11px] font-bold" style={seg(L.vAlign !== "top")}>Center</button>
            <button type="button" onClick={() => set({ vAlign: "top" })} className="flex-1 py-1.5 rounded-md border text-[11px] font-bold" style={seg(L.vAlign === "top")}>Top</button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <ColorField label="Background" value={L.background} def="#0E2A47" onChange={(v) => set({ background: v })} />
        {!full && <ColorField label="Card color" value={L.cardBg} def="#ffffff" onChange={(v) => set({ cardBg: v })} />}
        <ColorField label="Text color" value={L.textColor} def="#0E2A47" onChange={(v) => set({ textColor: v })} />
        <label className={cell}>Max width px
          <input type="number" min={0} value={L.maxWidth ?? ""} onChange={(e) => set({ maxWidth: num(e.target.value) })} placeholder="448" className={ipt} />
        </label>
      </div>
      <label className={cell}>Background image URL (hero)
        <input value={L.backgroundImage || ""} onChange={(e) => set({ backgroundImage: e.target.value || undefined })} placeholder="https://…/photo.jpg" className={ipt} />
      </label>
      {L.backgroundImage && (
        <label className={cell}>Darken image {L.overlayOpacity ?? 0}%
          <input type="range" min={0} max={90} value={L.overlayOpacity ?? 0} onChange={(e) => set({ overlayOpacity: parseInt(e.target.value) })} className="w-full mt-1 accent-violet-600" />
        </label>
      )}
      <label className="flex items-center gap-2 text-[12px] text-gray-600">
        <input type="checkbox" checked={!!L.hideProgress} onChange={(e) => set({ hideProgress: e.target.checked || undefined })} className="accent-violet-600" />
        Hide the progress bar on this step
      </label>
    </div>
  );
}

function StylePanel({ style, onChange }: { style?: BlockStyle; onChange: (patch: Partial<Block>) => void }) {
  const s = style || {};
  const set = (patch: Partial<BlockStyle>) => onChange({ style: { ...s, ...patch } });
  const num = (v: string) => (v === "" ? undefined : Math.max(0, parseInt(v) || 0));
  const has = Object.values(s).some((v) => v !== undefined && v !== "");
  const cell = "text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide";
  const ipt = "w-full mt-1 px-2 py-1 text-[12px] border border-gray-200 rounded-md";
  return (
    <details className="mt-2">
      <summary className="cursor-pointer select-none list-none flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-violet-600">
        <Palette className="w-3 h-3" /> Style{has && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />}
      </summary>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <label className={cell}>Align
          <div className="flex gap-1 mt-1">
            {(["left", "center", "right"] as const).map((a) => (
              <button key={a} type="button" onClick={() => set({ align: s.align === a ? undefined : a })}
                className="flex-1 py-1 rounded-md border text-[11px] font-bold" style={s.align === a ? { background: "#EFE9FF", color: "#6D3EF0", borderColor: "#6D3EF0" } : { color: "#9CA3AF", borderColor: "#E5E7EB" }}>
                {a[0].toUpperCase()}
              </button>
            ))}
          </div>
        </label>
        <label className={cell}>Size px
          <input type="number" min={0} value={s.fontSize ?? ""} onChange={(e) => set({ fontSize: num(e.target.value) })} placeholder="—" className={ipt} />
        </label>
        <label className={cell}>Weight
          <select value={s.fontWeight ?? ""} onChange={(e) => set({ fontWeight: e.target.value === "" ? undefined : parseInt(e.target.value) })} className={ipt}>
            <option value="">—</option>
            {[400, 500, 600, 700, 800].map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <ColorField label="Text color" value={s.color} def="#0E2A47" onChange={(v) => set({ color: v })} />
        <ColorField label="Background" value={s.background} def="#ffffff" onChange={(v) => set({ background: v })} />
        <label className={cell}>Radius px
          <input type="number" min={0} value={s.radius ?? ""} onChange={(e) => set({ radius: num(e.target.value) })} placeholder="—" className={ipt} />
        </label>
        <label className={cell}>Padding px
          <input type="number" min={0} value={s.padding ?? ""} onChange={(e) => set({ padding: num(e.target.value) })} placeholder="—" className={ipt} />
        </label>
        <label className={cell}>Space above
          <input type="number" min={0} value={s.marginTop ?? ""} onChange={(e) => set({ marginTop: num(e.target.value) })} placeholder="—" className={ipt} />
        </label>
        {has && (
          <div className="flex items-end">
            <button type="button" onClick={() => onChange({ style: undefined })} className="text-[10.5px] text-rose-400 font-semibold">Reset all</button>
          </div>
        )}
      </div>
    </details>
  );
}

function BranchEditor({ step, steps, onChange }: { step: Step; steps: Step[]; onChange: (logic: Step["logic"]) => void }) {
  const logic = step.logic || [];
  const input = "px-2 py-1.5 text-[12.5px] border border-gray-200 rounded-lg";
  return (
    <div className="dgs-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-bold text-ink uppercase tracking-wide">Branching</span>
        <button onClick={() => onChange([...logic, { field: "inServiceArea", op: "eq", value: "false", goto: steps[0].id }])} className="text-[12px] text-violet-600 font-semibold">+ Rule</button>
      </div>
      {logic.length === 0 && <p className="text-[12px] text-gray-400">No rules — this step continues to the next one in order.</p>}
      <div className="space-y-1.5">
        {logic.map((r, i) => (
          <div key={i} className="flex items-center gap-1 flex-wrap text-[12px] text-gray-600">
            If <input value={r.field} onChange={(e) => onChange(logic.map((x, j) => j === i ? { ...x, field: e.target.value } : x))} className={`${input} w-28`} />
            <select value={r.op} onChange={(e) => onChange(logic.map((x, j) => j === i ? { ...x, op: e.target.value as "eq" | "neq" | "in" } : x))} className={input}><option value="eq">=</option><option value="neq">≠</option></select>
            <input value={String(r.value)} onChange={(e) => onChange(logic.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} className={`${input} w-24`} />
            → <select value={r.goto} onChange={(e) => onChange(logic.map((x, j) => j === i ? { ...x, goto: e.target.value } : x))} className={input}>
              {steps.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="@finish">Finish</option>
            </select>
            <button onClick={() => onChange(logic.filter((_, j) => j !== i))} className="text-gray-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
