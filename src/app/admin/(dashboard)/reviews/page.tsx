"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Star, Plus, Pencil, Trash2, Search, Filter, X, ExternalLink, Loader2,
  MessageSquareQuote, CheckCircle2, Clock, Link2, AlertTriangle, RefreshCw, Unlink,
} from "lucide-react";

const SOURCE_FIELDS: { key: string; label: string; hint?: string }[] = [
  { key: "reviews.google.url", label: "Google reviews link" },
  { key: "reviews.google.writeUrl", label: 'Google "leave a review" link', hint: "Used inside review-request texts. Grab it from your Google Business Profile → Ask for reviews." },
  { key: "reviews.yelp.url", label: "Yelp reviews link" },
  { key: "reviews.yelp.notRecommendedUrl", label: "Yelp – Not Recommended link" },
];

interface Review {
  id: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  platform: string;
  status: string;
  rating: number | null;
  reviewText: string | null;
  reviewUrl: string | null;
  requestedAt: string | null;
  reviewedAt: string | null;
  requestChannel: string | null;
  notes: string | null;
  createdAt: string;
}

interface Stats { total: number; completed: number; requested: number; declined: number; avgRating: number | null; }

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  REQUESTED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  DECLINED: "bg-gray-100 text-gray-600",
};
const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending", REQUESTED: "Requested", COMPLETED: "Completed", DECLINED: "Declined",
};
const PLATFORM_LABELS: Record<string, string> = { google: "Google", yelp: "Yelp", facebook: "Facebook" };

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Stars({ rating, className = "" }: { rating: number | null; className?: string }) {
  if (!rating) return <span className="text-gray-300 text-sm">—</span>;
  return (
    <span className={`inline-flex ${className}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`w-4 h-4 ${n <= rating ? "text-amber-400 fill-amber-400" : "text-gray-200"}`} />
      ))}
    </span>
  );
}

type FormState = {
  customerName: string; phone: string; email: string; platform: string; status: string;
  rating: number | null; reviewUrl: string; reviewText: string; notes: string;
};
const EMPTY_FORM: FormState = {
  customerName: "", phone: "", email: "", platform: "google", status: "REQUESTED",
  rating: null, reviewUrl: "", reviewText: "", notes: "",
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, completed: 0, requested: 0, declined: 0, avgRating: null });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");

  const [editing, setEditing] = useState<Review | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // App settings (review-source links + Google connection status)
  const [sources, setSources] = useState<Record<string, string>>({});
  const [editSources, setEditSources] = useState(false);
  const [sourceForm, setSourceForm] = useState<Record<string, string>>({});
  const [savingSources, setSavingSources] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const googleParam = searchParams.get("google");

  const loadSettings = useCallback(() => {
    fetch("/api/admin/app-settings")
      .then((r) => (r.ok ? r.json() : { settings: {} }))
      .then((d) => setSources(d.settings || {}))
      .catch(() => {});
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  async function syncGoogle() {
    setSyncingGoogle(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/admin/reviews/sync-google", { method: "POST" });
      const d = await res.json();
      if (res.ok) { setSyncMsg(`Imported ${d.imported} Google review${d.imported === 1 ? "" : "s"}.`); await load(); loadSettings(); }
      else setSyncMsg(d.error || "Sync failed.");
    } catch {
      setSyncMsg("Sync failed.");
    } finally {
      setSyncingGoogle(false);
    }
  }

  async function disconnectGoogle() {
    if (!confirm("Disconnect Google Business Profile? Imported reviews stay, but syncing stops.")) return;
    await fetch("/api/admin/app-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: {
        "google.oauth.refreshToken": "", "google.bp.connectedEmail": "",
        "google.bp.accountId": "", "google.bp.locationId": "", "google.bp.locationTitle": "",
      } }),
    });
    loadSettings();
  }

  function startEditSources() {
    const f: Record<string, string> = {};
    for (const s of SOURCE_FIELDS) f[s.key] = sources[s.key] || "";
    setSourceForm(f);
    setEditSources(true);
  }
  async function saveSources() {
    setSavingSources(true);
    try {
      const res = await fetch("/api/admin/app-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: sourceForm }),
      });
      if (res.ok) { setSources((prev) => ({ ...prev, ...sourceForm })); setEditSources(false); }
    } finally {
      setSavingSources(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (statusFilter !== "all") p.set("status", statusFilter);
      if (platformFilter !== "all") p.set("platform", platformFilter);
      if (search) p.set("search", search);
      const res = await fetch(`/api/admin/reviews?${p}`);
      if (res.ok) {
        const d = await res.json();
        setReviews(d.reviews || []);
        setStats(d.stats);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, platformFilter, search]);

  useEffect(() => { load(); }, [load]);

  function startEdit(r: Review | "new") {
    setEditing(r);
    setForm(r === "new" ? EMPTY_FORM : {
      customerName: r.customerName, phone: r.phone || "", email: r.email || "",
      platform: r.platform, status: r.status, rating: r.rating,
      reviewUrl: r.reviewUrl || "", reviewText: r.reviewText || "", notes: r.notes || "",
    });
  }

  async function save() {
    if (!form.customerName.trim() || saving) return;
    setSaving(true);
    try {
      const isNew = editing === "new";
      const url = isNew ? "/api/admin/reviews" : `/api/admin/reviews/${(editing as Review).id}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) { setEditing(null); await load(); }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this review record?")) return;
    const res = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  const statCard = (label: string, value: string | number, Icon: typeof Star, tint: string) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${tint}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-lg font-semibold text-navy-900 leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );

  const connectedEmail = sources["google.bp.connectedEmail"];
  const locationTitle = sources["google.bp.locationTitle"];
  const lastSynced = sources["google.bp.lastSyncedAt"] ? fmtDate(sources["google.bp.lastSyncedAt"]) : null;

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Reviews</h1>
          <p className="text-navy-600 mt-1">Track review requests and their outcomes</p>
        </div>
        <button
          onClick={() => startEdit("new")}
          className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Review
        </button>
      </div>

      {/* Review sources */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-gray-400" />
            Review sources
          </h2>
          {!editSources && (
            <button onClick={startEditSources} className="flex items-center gap-1 text-xs text-teal-600 hover:underline">
              <Pencil className="w-3.5 h-3.5" /> Edit links
            </button>
          )}
        </div>

        {editSources ? (
          <div className="space-y-3">
            {SOURCE_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                <input
                  value={sourceForm[f.key] ?? ""}
                  onChange={(e) => setSourceForm({ ...sourceForm, [f.key]: e.target.value })}
                  placeholder="https://…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
                {f.hint && <p className="text-[11px] text-gray-400 mt-1">{f.hint}</p>}
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <button onClick={saveSources} disabled={savingSources} className="flex items-center gap-2 px-4 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium">
                {savingSources && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </button>
              <button onClick={() => setEditSources(false)} className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {[
                { key: "reviews.google.url", label: "View on Google" },
                { key: "reviews.yelp.url", label: "View on Yelp" },
                { key: "reviews.yelp.notRecommendedUrl", label: "Yelp – Not Recommended" },
              ].map((b) =>
                sources[b.key] ? (
                  <a key={b.key} href={sources[b.key]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-navy-900 hover:bg-gray-50">
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" /> {b.label}
                  </a>
                ) : (
                  <span key={b.key} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-200 rounded-lg text-sm text-gray-400">{b.label} (not set)</span>
                )
              )}
            </div>
            {!sources["reviews.google.writeUrl"] && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Add your Google &quot;leave a review&quot; link (Edit links) so review-request texts can include it.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Google connect banner */}
      {googleParam && (
        <div className={`rounded-xl px-4 py-3 text-sm border ${
          googleParam === "connected" ? "bg-green-50 border-green-200 text-green-800" :
          googleParam === "denied" ? "bg-gray-50 border-gray-200 text-gray-600" :
          googleParam === "notconfigured" ? "bg-amber-50 border-amber-200 text-amber-800" :
          "bg-red-50 border-red-200 text-red-800"
        }`}>
          {googleParam === "connected" ? "Google connected. Click “Sync now” to import your reviews." :
           googleParam === "denied" ? "Google authorization was cancelled." :
           googleParam === "state" ? "That sign-in link expired — please connect again." :
           googleParam === "notconfigured" ? "Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET (Vercel env), redeploy, then connect." :
           "Couldn’t connect to Google. Check your setup and try again."}
        </div>
      )}

      {/* Google Business Profile connection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0"><Star className="w-4 h-4 text-blue-500" /></div>
            <div>
              <h2 className="text-sm font-semibold text-navy-900">Google Business Profile</h2>
              {connectedEmail ? (
                <p className="text-xs text-gray-500">
                  Connected as {connectedEmail}{locationTitle ? ` · ${locationTitle}` : ""}{lastSynced ? ` · synced ${lastSynced}` : ""}
                </p>
              ) : (
                <p className="text-xs text-gray-500">Import all your Google reviews automatically.</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connectedEmail ? (
              <>
                <button onClick={syncGoogle} disabled={syncingGoogle} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium">
                  {syncingGoogle ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Sync now
                </button>
                <button onClick={disconnectGoogle} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm text-gray-600">
                  <Unlink className="w-4 h-4" /> Disconnect
                </button>
              </>
            ) : (
              <button onClick={() => { window.location.href = "/api/admin/google/oauth/start"; }} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                Connect Google
              </button>
            )}
          </div>
        </div>
        {syncMsg && <p className="text-xs text-gray-600 mt-2">{syncMsg}</p>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCard("Total", stats.total, MessageSquareQuote, "bg-teal-50 text-teal-600")}
        {statCard("Completed", stats.completed, CheckCircle2, "bg-green-50 text-green-600")}
        {statCard("Awaiting", stats.requested, Clock, "bg-blue-50 text-blue-600")}
        {statCard("Avg rating", stats.avgRating ?? "—", Star, "bg-amber-50 text-amber-500")}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, email…"
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm appearance-none bg-white">
              <option value="all">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="REQUESTED">Requested</option>
              <option value="COMPLETED">Completed</option>
              <option value="DECLINED">Declined</option>
            </select>
          </div>
          <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm appearance-none bg-white">
            <option value="all">All Platforms</option>
            <option value="google">Google</option>
            <option value="yelp">Yelp</option>
            <option value="facebook">Facebook</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-teal-600" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Customer", "Platform", "Status", "Rating", "Requested", "Reviewed", ""].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reviews.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">No reviews yet. Add one, or the auto-request flow will populate this after a customer&apos;s first cleanup.</td></tr>
                ) : reviews.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-navy-900">{r.customerName}</div>
                      <div className="text-xs text-gray-500">{r.phone || r.email || ""}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{PLATFORM_LABELS[r.platform] || r.platform}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLES[r.status] || "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4"><Stars rating={r.rating} /></td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{fmtDate(r.requestedAt)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{fmtDate(r.reviewedAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        {r.reviewUrl && (
                          <a href={r.reviewUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Open review">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button onClick={() => startEdit(r)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Edit"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => remove(r.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-navy-900">{editing === "new" ? "Add Review" : "Edit Review"}</h2>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer name *</label>
                <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                  <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
                    <option value="google">Google</option>
                    <option value="yelp">Yelp</option>
                    <option value="facebook">Facebook</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
                    <option value="PENDING">Pending</option>
                    <option value="REQUESTED">Requested</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="DECLINED">Declined</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setForm({ ...form, rating: form.rating === n ? null : n })}>
                      <Star className={`w-6 h-6 ${form.rating && n <= form.rating ? "text-amber-400 fill-amber-400" : "text-gray-200"}`} />
                    </button>
                  ))}
                  {form.rating && <button type="button" onClick={() => setForm({ ...form, rating: null })} className="ml-2 text-xs text-gray-400 hover:text-gray-600">clear</button>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Review link</label>
                <input value={form.reviewUrl} onChange={(e) => setForm({ ...form, reviewUrl: e.target.value })} placeholder="https://…" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Review text</label>
                <textarea value={form.reviewText} onChange={(e) => setForm({ ...form, reviewText: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200">Cancel</button>
              <button onClick={save} disabled={saving || !form.customerName.trim()} className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing === "new" ? "Add" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
