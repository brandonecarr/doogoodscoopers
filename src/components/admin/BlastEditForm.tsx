"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Save } from "lucide-react";

export function BlastEditForm({ campaignId, initialName, initialBody }: { campaignId: string; initialName: string; initialBody: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [body, setBody] = useState(initialBody);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!name.trim() || !body.trim()) return setError("Name and message are required.");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), body: body.trim() }),
      });
      const data = await res.json();
      if (res.ok) router.push("/admin/campaigns");
      else setError(data.error || "Failed to save");
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/campaigns" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <h1 className="text-2xl font-bold text-navy-900">Edit Campaign</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Campaign name"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Message…  Use {{firstName}}, {{zipCode}} or {{numberOfDogs}} to personalize."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-400">Editing only affects messages not yet sent. Recipients can&apos;t be changed after creation.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
