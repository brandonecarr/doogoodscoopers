"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyLinkButton({ link, label = "Copy" }: { link: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setDone(true); setTimeout(() => setDone(false), 1500); } catch { window.prompt("Copy this link:", link); }
  };
  return (
    <button type="button" onClick={copy} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-navy-900">
      {done ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
      {done ? "Copied" : label}
    </button>
  );
}
