"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ExternalLink, Merge, Loader2 } from "lucide-react";

interface Duplicate {
  leadType: string;
  id: string;
  name: string;
  phone: string;
  status: string | null;
  createdAt: string;
  url: string;
  mergeable: boolean;
}

const typeLabel: Record<string, string> = {
  quote: "Quote",
  adlead: "Ad Lead",
  outofarea: "Out of Area",
  commercial: "Commercial",
  career: "Career",
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function DuplicateBanner({ leadId, leadType }: { leadId: string; leadType: "quote" | "adlead" }) {
  const router = useRouter();
  const [dupes, setDupes] = useState<Duplicate[]>([]);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/lead-duplicates?leadId=${leadId}&leadType=${leadType}`)
      .then((r) => (r.ok ? r.json() : { duplicates: [] }))
      .then((d) => setDupes(d.duplicates || []))
      .catch(() => {});
  }, [leadId, leadType]);

  if (dupes.length === 0) return null;

  const mergeable = dupes.filter((d) => d.mergeable);

  const handleMerge = async () => {
    if (
      !confirm(
        `Merge ${mergeable.length} duplicate lead${mergeable.length > 1 ? "s" : ""} into this one? ` +
          `All their info, messages, and history move here, and the duplicates are removed. This can't be undone.`
      )
    )
      return;
    setMerging(true);
    try {
      const res = await fetch("/api/admin/lead-duplicates/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadType, survivorId: leadId, mergeIds: mergeable.map((d) => d.id) }),
      });
      if (res.ok) router.refresh();
      else {
        const data = await res.json();
        alert(data.error || "Merge failed");
      }
    } catch {
      alert("Merge failed");
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            {dupes.length} other lead{dupes.length > 1 ? "s" : ""} share this phone number
          </p>
          <ul className="mt-2 space-y-1.5">
            {dupes.map((d) => (
              <li key={`${d.leadType}-${d.id}`} className="flex items-center gap-2 text-sm">
                <Link href={d.url} className="text-amber-900 hover:text-amber-700 font-medium inline-flex items-center gap-1">
                  {d.name}
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <span className="px-1.5 py-0.5 text-[11px] rounded bg-amber-100 text-amber-800">{typeLabel[d.leadType] || d.leadType}</span>
                {d.status && <span className="text-[11px] text-amber-700">{d.status.replace(/_/g, " ")}</span>}
                <span className="text-[11px] text-amber-600">· {fmt(d.createdAt)}</span>
              </li>
            ))}
          </ul>
          {mergeable.length > 0 && (
            <div className="mt-3">
              <button
                onClick={handleMerge}
                disabled={merging}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {merging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Merge className="w-3.5 h-3.5" />}
                {merging ? "Merging…" : `Merge ${mergeable.length} into this lead`}
              </button>
              {dupes.length > mergeable.length && (
                <p className="text-[11px] text-amber-700 mt-1.5">
                  Only same-type ({typeLabel[leadType]}) leads can be merged; other types are linked above.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
