"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2, LayoutTemplate, Loader2 } from "lucide-react";

interface Template { id: string; name: string; subject: string | null; category: string | null; updatedAt: string }

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    fetch("/api/admin/email-templates")
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => setTemplates(d.templates || []))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!confirm("Delete this template?")) return;
    const res = await fetch(`/api/admin/email-templates/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/email" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600" /></Link>
          <div>
            <h1 className="text-2xl font-bold text-navy-900">Email Templates</h1>
            <p className="text-navy-600 text-sm mt-1">Design reusable emails with the drag-and-drop builder.</p>
          </div>
        </div>
        <Link href="/admin/email/templates/new" className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Template
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-teal-600" /></div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <LayoutTemplate className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No templates yet.</p>
          <Link href="/admin/email/templates/new" className="text-teal-600 text-sm font-medium hover:underline mt-2 inline-block">Design your first →</Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0"><LayoutTemplate className="w-5 h-5 text-teal-600" /></div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-navy-900 truncate">{t.name}</p>
                {t.subject && <p className="text-sm text-gray-500 truncate">{t.subject}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Link href={`/admin/email/templates/${t.id}`} className="p-2 rounded hover:bg-gray-100 text-gray-500" title="Edit"><Pencil className="w-4 h-4" /></Link>
                <button onClick={() => remove(t.id)} className="p-2 rounded hover:bg-red-50 text-red-500" title="Delete"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
