"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GripVertical, Plus, Trash2, Save, Eye, EyeOff, ExternalLink, Loader2, Rocket,
} from "lucide-react";
import type { FunnelData, Step, Block, BlockType, ContactField } from "@/lib/funnel/types";
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
  const addBlock = (type: BlockType) => {
    if (!sel) return;
    const base: Block = { id: uid("b"), type };
    if (type === "choice") { base.field = "numberOfDogs"; base.options = [{ value: "1", label: "1 dog" }, { value: "2", label: "2 dogs" }]; }
    if (type === "contactForm") base.fields = ["firstName", "phone", "email"];
    if (type === "cta") { base.ctaKind = "next"; base.label = "Continue"; }
    if (type === "heading") base.text = "Heading";
    if (type === "text") base.text = "Some text";
    if (type === "zipCheck") base.label = "Check my area";
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
        </div>

        {/* Step editor */}
        <div className="space-y-3">
          {sel && (
            <>
              <div className="dgs-card p-4">
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Step name</label>
                <input value={sel.name} onChange={(e) => patchStep(sel.id, { name: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              </div>

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
                    </div>
                  ))}
                </div>
              </div>

              <BranchEditor step={sel} steps={steps} onChange={(logic) => patchStep(sel.id, { logic })} />
            </>
          )}

          {/* Theme + settings */}
          <div className="dgs-card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-500 mb-1">Accent color</span>
              <input type="color" value={data.theme?.primary || "#6D3EF0"} onChange={(e) => setData((d) => ({ ...d, theme: { ...d.theme, primary: e.target.value } }))} className="h-9 w-full rounded-lg border border-gray-200" />
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-[11px] font-semibold text-gray-500 mb-1">Booking handoff URL (Sweep&amp;Go)</span>
              <input value={data.settings?.bookingUrl || ""} onChange={(e) => setData((d) => ({ ...d, settings: { ...d.settings, bookingUrl: e.target.value } }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </label>
          </div>
        </div>

        {/* Live preview */}
        {showPreview && (
          <div className="dgs-card p-2 h-fit lg:sticky lg:top-[92px] overflow-hidden">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide px-2 py-1">Live preview</div>
            <div className="rounded-xl overflow-hidden border border-gray-100" style={{ height: 560 }}>
              <div className="scale-[0.72] origin-top-left" style={{ width: "139%", height: "139%" }}>
                <FunnelRunner key={`${av}-${JSON.stringify(previewData).length}-${selId}`} funnelId={initial.id} slug={slug} data={previewData} preview forceVariant={av} />
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
      return <input value={block.imageUrl || ""} onChange={(e) => onChange({ imageUrl: e.target.value })} placeholder="Image URL" className={input} />;
    case "zipCheck":
      return <input value={block.label || ""} onChange={(e) => onChange({ label: e.target.value })} placeholder="Button label" className={input} />;
    case "priceEstimate":
      return <p className="text-[12px] text-gray-400">Shows the live Sweep&amp;Go estimate from the ZIP + answers.</p>;
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
