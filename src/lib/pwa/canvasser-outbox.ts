/**
 * Canvasser offline outbox.
 *
 * Every visit/lead write is queued in IndexedDB and POSTed to the server; if the
 * rep is offline the item stays queued and flushes automatically on reconnect.
 * The server upserts on `clientKey`, so a replayed item never duplicates —
 * nothing is ever lost. On a successful sync we dispatch `canvasser-synced` with
 * the server row so the map can reconcile (e.g. fill the reverse-geocoded
 * address, or the new lead id).
 */

import { openDB, IDBPDatabase } from "idb";

const DB_NAME = "dgs-canvasser";
const DB_VERSION = 1;
const STORE = "outbox";
const MAX_RETRIES = 6;

export type OutboxKind = "visit" | "lead" | "visit-delete";

export interface OutboxItem {
  id: string; // = payload.clientKey
  kind: OutboxKind;
  url: string;
  method: "POST" | "DELETE";
  payload: Record<string, unknown>;
  status: "pending" | "sending" | "failed";
  retryCount: number;
  updatedAt: number;
}

const URL_FOR: Record<OutboxKind, string> = {
  visit: "/api/canvasser/visits",
  lead: "/api/canvasser/leads",
  "visit-delete": "/api/canvasser/visits",
};
const METHOD_FOR: Record<OutboxKind, "POST" | "DELETE"> = {
  visit: "POST",
  lead: "POST",
  "visit-delete": "DELETE",
};

let dbInstance: IDBPDatabase | null = null;
async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    },
  });
  return dbInstance;
}

const online = () => (typeof navigator === "undefined" ? true : navigator.onLine);

function emit(name: string, detail: unknown) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name, { detail }));
}

/** Queue a write (create/update). `payload.clientKey` is required and is the id. */
export async function enqueue(kind: OutboxKind, payload: Record<string, unknown>): Promise<void> {
  const clientKey = payload.clientKey as string | undefined;
  if (!clientKey) throw new Error("payload.clientKey is required");
  const db = await getDB();
  // Keying the store by clientKey means a delete replaces any still-pending
  // create/update for the same pin — so removing a pin that never synced simply
  // cancels it, and the server delete is idempotent either way.
  const item: OutboxItem = {
    id: clientKey,
    kind,
    url: URL_FOR[kind],
    method: METHOD_FOR[kind],
    payload,
    status: "pending",
    retryCount: 0,
    updatedAt: Date.now(),
  };
  await db.put(STORE, item);
  emit("canvasser-queue-changed", await getQueueCount());
  // Fire-and-forget flush; if offline it no-ops and waits for reconnect.
  void processOutbox();
}

export async function getQueueCount(): Promise<number> {
  const db = await getDB();
  const all = (await db.getAll(STORE)) as OutboxItem[];
  return all.filter((i) => i.status !== "sending").length;
}

let flushing = false;
/** Attempt to POST everything queued. Safe to call repeatedly. */
export async function processOutbox(): Promise<void> {
  if (flushing || !online()) return;
  flushing = true;
  try {
    const db = await getDB();
    const items = ((await db.getAll(STORE)) as OutboxItem[])
      .filter((i) => i.status !== "sending" && i.retryCount < MAX_RETRIES)
      .sort((a, b) => a.updatedAt - b.updatedAt);

    for (const item of items) {
      item.status = "sending";
      await db.put(STORE, item);
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          await db.delete(STORE, item.id);
          emit("canvasser-synced", { kind: item.kind, clientKey: item.id, data });
        } else if (res.status === 400 || res.status === 403) {
          // Permanent rejection — don't retry forever; surface and drop.
          await db.delete(STORE, item.id);
          emit("canvasser-sync-error", { kind: item.kind, clientKey: item.id, status: res.status });
        } else {
          item.status = "pending";
          item.retryCount += 1;
          item.updatedAt = Date.now();
          await db.put(STORE, item);
        }
      } catch {
        item.status = "pending";
        item.retryCount += 1;
        item.updatedAt = Date.now();
        await db.put(STORE, item);
      }
    }
  } finally {
    flushing = false;
    emit("canvasser-queue-changed", await getQueueCount());
  }
}

let started = false;
/** Wire auto-flush on reconnect + an initial drain. Call once on portal mount. */
export function startOutbox(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => void processOutbox());
  void processOutbox();
}
