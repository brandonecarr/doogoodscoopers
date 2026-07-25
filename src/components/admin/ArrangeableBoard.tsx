"use client";

import { ReactNode, useEffect, useState } from "react";
import { GripVertical, LayoutGrid, Check, RotateCcw } from "lucide-react";

// A two-zone (wide "main" + narrow "side") card board whose arrangement the user
// can edit by dragging cards between zones and reordering them. Each card sits in
// a `@container`, so a card moved into the wide zone automatically gets more room
// and its container-query internals (e.g. @lg:grid-cols-2) reflow to fill it.
// The layout is saved per-page in localStorage.

export type CardZone = "main" | "side";
export interface ArrangeableCard {
  id: string;
  zone: CardZone; // default zone
  node: ReactNode;
}
interface Layout {
  main: string[];
  side: string[];
}

function defaultLayout(cards: ArrangeableCard[]): Layout {
  return {
    main: cards.filter((c) => c.zone === "main").map((c) => c.id),
    side: cards.filter((c) => c.zone === "side").map((c) => c.id),
  };
}

// Keep a saved layout valid as cards appear/disappear: drop unknown ids, append
// any new card to its default zone.
function reconcile(saved: Layout | null, cards: ArrangeableCard[]): Layout {
  const def = defaultLayout(cards);
  if (!saved || !Array.isArray(saved.main) || !Array.isArray(saved.side)) return def;
  const known = new Map(cards.map((c) => [c.id, c]));
  const main = saved.main.filter((id) => known.has(id));
  const side = saved.side.filter((id) => known.has(id));
  const placed = new Set([...main, ...side]);
  for (const c of cards) if (!placed.has(c.id)) (c.zone === "side" ? side : main).push(c.id);
  return { main, side };
}

export function ArrangeableBoard({ layoutId, cards }: { layoutId: string; cards: ArrangeableCard[] }) {
  const storageKey = `arrange:${layoutId}`;
  const [layout, setLayout] = useState<Layout>(() => defaultLayout(cards));
  const [edit, setEdit] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ zone: CardZone; index: number } | null>(null);

  // Load saved arrangement after mount (avoids SSR/hydration mismatch).
  useEffect(() => {
    let saved: Layout | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) saved = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    setLayout(reconcile(saved, cards));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const nodeById = (id: string) => cards.find((c) => c.id === id)?.node ?? null;

  const save = (next: Layout) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  // Insert the dragged card into `zone` at `index` (before that position).
  const applyMove = (zone: CardZone, index: number) => {
    if (!dragId) return;
    setLayout((prev) => {
      const main = prev.main.filter((x) => x !== dragId);
      const side = prev.side.filter((x) => x !== dragId);
      const target = zone === "main" ? main : side;
      let idx = index;
      const fromMain = prev.main.includes(dragId);
      const fromZone: CardZone = fromMain ? "main" : "side";
      if (fromZone === zone) {
        const fromIdx = (fromMain ? prev.main : prev.side).indexOf(dragId);
        if (fromIdx > -1 && fromIdx < index) idx = index - 1;
      }
      idx = Math.max(0, Math.min(idx, target.length));
      target.splice(idx, 0, dragId);
      const next = { main, side };
      save(next);
      return next;
    });
  };

  const endDrag = () => {
    setDragId(null);
    setOver(null);
  };

  const reset = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setLayout(defaultLayout(cards));
  };

  const zoneClass = (zone: CardZone) =>
    `space-y-6 ${zone === "main" ? "lg:col-span-2" : ""} ${
      edit ? "rounded-xl outline-2 outline-dashed outline-gray-200 outline-offset-4 min-h-24" : ""
    }`;

  const renderZone = (zone: CardZone, ids: string[]) => (
    <div
      className={zoneClass(zone)}
      onDragOver={(e) => {
        if (edit && dragId) {
          e.preventDefault();
          if (ids.length === 0) setOver({ zone, index: 0 });
        }
      }}
      onDrop={(e) => {
        if (edit && dragId) {
          e.preventDefault();
          applyMove(zone, over?.zone === zone ? over.index : ids.length);
          endDrag();
        }
      }}
    >
      {ids.length === 0 && edit && (
        <div className="text-center text-sm text-gray-400 py-8">Drop a card here</div>
      )}
      {ids.map((id, index) => (
        <div key={id}>
          {edit && over?.zone === zone && over.index === index && (
            <div className="h-1.5 -mb-3.5 rounded-full bg-teal-400" />
          )}
          <div
            className={`@container relative ${dragId === id ? "opacity-40" : ""}`}
            draggable={edit}
            onDragStart={(e) => {
              if (!edit) return;
              setDragId(id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={endDrag}
            onDragOver={(e) => {
              if (!edit || !dragId) return;
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              const after = e.clientY > r.top + r.height / 2;
              setOver({ zone, index: after ? index + 1 : index });
            }}
            onDrop={(e) => {
              if (!edit || !dragId) return;
              e.preventDefault();
              e.stopPropagation();
              applyMove(zone, over?.zone === zone ? over.index : index);
              endDrag();
            }}
          >
            {edit && (
              <div className="absolute -top-2 -left-2 z-10 flex items-center gap-1 px-2 py-1 rounded-lg bg-navy-900 text-white text-xs shadow-md cursor-grab active:cursor-grabbing">
                <GripVertical className="w-3.5 h-3.5" />
                Drag
              </div>
            )}
            <div className={edit ? "pointer-events-none select-none rounded-xl ring-2 ring-teal-200" : ""}>
              {nodeById(id)}
            </div>
          </div>
          {edit && over?.zone === zone && over.index === index + 1 && index === ids.length - 1 && (
            <div className="h-1.5 -mt-3.5 rounded-full bg-teal-400" />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-4">
        {edit && (
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        )}
        <button
          onClick={() => {
            setEdit((v) => !v);
            endDrag();
          }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border ${
            edit
              ? "bg-teal-600 text-white border-teal-600 hover:bg-teal-700"
              : "border-gray-200 text-navy-900 hover:bg-gray-50"
          }`}
        >
          {edit ? <Check className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          {edit ? "Done" : "Edit Arrangement"}
        </button>
      </div>

      {edit && (
        <p className="text-xs text-gray-500 mb-4 text-right">
          Drag cards to reorder or move them between the wide and narrow columns. Your layout is saved on this device.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {renderZone("main", layout.main)}
        {renderZone("side", layout.side)}
      </div>
    </div>
  );
}
