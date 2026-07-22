"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, Mail, Users } from "lucide-react";

interface Row {
  id: string;
  name: string;
  active: boolean;
  triggerLabels: string[];
  stepCount: number;
  activeCount: number;
  sentCount: number;
}

export default function AutomationsList({ rows }: { rows: Row[] }) {
  const [items, setItems] = useState(rows);

  async function toggle(id: string, active: boolean) {
    setItems((p) => p.map((r) => (r.id === id ? { ...r, active } : r)));
    const res = await fetch(`/api/admin/email-automations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (!res.ok) setItems((p) => p.map((r) => (r.id === id ? { ...r, active: !active } : r)));
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
      {items.map((r) => (
        <div key={r.id} className="flex items-center gap-4 p-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${r.active ? "bg-teal-50" : "bg-gray-100"}`}>
            <Zap className={`w-5 h-5 ${r.active ? "text-teal-600" : "text-gray-400"}`} />
          </div>
          <Link href={`/admin/email/automations/${r.id}`} className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-navy-900 truncate">{r.name}</span>
              {r.triggerLabels.map((t) => (
                <span key={t} className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 text-gray-600">{t}</span>
              ))}
            </div>
            <p className="text-sm text-gray-500 flex items-center gap-3 mt-0.5">
              <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{r.stepCount} email{r.stepCount === 1 ? "" : "s"}</span>
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{r.activeCount} active</span>
              <span>{r.sentCount} sent</span>
            </p>
          </Link>
          <button
            type="button"
            onClick={() => toggle(r.id, !r.active)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${r.active ? "bg-teal-600" : "bg-gray-200"}`}
            aria-label={r.active ? "Pause" : "Activate"}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${r.active ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>
      ))}
    </div>
  );
}
