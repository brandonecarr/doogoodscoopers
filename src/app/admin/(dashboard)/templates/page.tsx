"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2, MessageSquare } from "lucide-react";

interface Template {
  id: string;
  name: string;
  body: string;
  category: string | null;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () =>
    fetch("/api/admin/message-templates")
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => setTemplates(d.templates || []))
      .catch(() => {});

  useEffect(() => {
    load();
  }, []);

  const startEdit = (t: Template | "new") => {
    setEditing(t);
    setName(t === "new" ? "" : t.name);
    setBody(t === "new" ? "" : t.body);
  };

  const cancel = () => {
    setEditing(null);
    setName("");
    setBody("");
  };

  const save = async () => {
    if (!name.trim() || !body.trim() || saving) return;
    setSaving(true);
    try {
      const isNew = editing === "new";
      const url = isNew ? "/api/admin/message-templates" : `/api/admin/message-templates/${(editing as Template).id}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), body: body.trim() }),
      });
      if (res.ok) {
        cancel();
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/admin/message-templates/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/campaigns" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-navy-900">Message Templates</h1>
            <p className="text-navy-600 text-sm mt-1">Reusable texts for lead replies and campaigns.</p>
          </div>
        </div>
        {editing === null && (
          <button
            onClick={() => startEdit("new")}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        )}
      </div>

      {editing !== null && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Message…  Use {{firstName}}, {{zipCode}} or {{dogs}} to personalize."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || !name.trim() || !body.trim()}
              className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={cancel} className="px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {templates.length === 0 && editing === null ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No templates yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-navy-900">{t.name}</p>
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{t.body}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => startEdit(t)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="Edit">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(t.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
