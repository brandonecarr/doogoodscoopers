"use client";

import { useEffect, useState } from "react";
import { Upload, Images, Loader2, X } from "lucide-react";
import { inputCls } from "./ui";

/* Pick an image: upload to the email-assets bucket, choose from what's there, or paste a URL. */

interface Asset { url: string; name: string }

export function ImagePicker({ value, onChange, label = "Image" }: { value: string; onChange: (url: string) => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!libOpen || assets) return;
    fetch("/api/admin/email-assets").then((r) => (r.ok ? r.json() : { assets: [] })).then((d) => setAssets(d.assets || [])).catch(() => setAssets([]));
  }, [libOpen, assets]);

  async function upload(file: File) {
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/email-assets", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok || !d.url) { setError(d.error || "Upload failed"); return; }
      onChange(d.url);
      setAssets(null);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-gray-200 bg-[repeating-conic-gradient(#f3f4f6_0_25%,#fff_0_50%)] bg-[length:14px_14px] p-2 flex items-center justify-center min-h-[88px]">
        {value ? <img src={value} alt="" className="max-h-28 max-w-full object-contain" /> : <span className="text-[12px] text-gray-400">No {label.toLowerCase()} yet</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <label className={`inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer ${busy ? "opacity-60" : ""}`}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Upload
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        </label>
        <button type="button" onClick={() => setLibOpen((o) => !o)} className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50"><Images className="w-3.5 h-3.5" /> Library</button>
        {value && <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1 h-8 px-2 text-[12px] text-gray-500 hover:text-red-600"><X className="w-3.5 h-3.5" /> Remove</button>}
      </div>
      {libOpen && (
        <div className="max-h-48 overflow-auto rounded-lg border border-gray-200 p-2 grid grid-cols-4 gap-1.5 bg-white">
          {assets === null ? <span className="col-span-4 text-[12px] text-gray-400">Loading…</span>
            : assets.length === 0 ? <span className="col-span-4 text-[12px] text-gray-400">Nothing uploaded yet.</span>
            : assets.map((a) => (
              <button key={a.url} type="button" title={a.name} onClick={() => { onChange(a.url); setLibOpen(false); }} className={`aspect-square rounded-md border overflow-hidden bg-gray-50 ${a.url === value ? "border-violet-500 ring-2 ring-violet-200" : "border-gray-200 hover:border-violet-300"}`}>
                <img src={a.url} alt="" className="w-full h-full object-contain" />
              </button>
            ))}
        </div>
      )}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="…or paste an image URL" className={`${inputCls} w-full text-[12px]`} />
      {error && <p className="text-[12px] text-red-600">{error}</p>}
    </div>
  );
}
