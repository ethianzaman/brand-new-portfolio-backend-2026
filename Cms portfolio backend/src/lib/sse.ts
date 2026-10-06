import type { Response } from "express";

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  Server-Sent Events registry
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Every open `/api/events` stream is held here. `publishChange()` broadcasts to
 * all of them, and the public `LiveRefresh` component calls `router.refresh()`
 * when it receives one — so a dashboard edit shows up on the visitor's open tab
 * in about a second, with no reload.
 *
 * Kept on `globalThis` so a nodemon restart in dev doesn't matter and so the
 * same registry instance is shared across modules.
 */

export interface SseClient {
  id: number;
  res: Response;
}

interface SseStore {
  clients: Map<number, SseClient>;
  nextId: number;
}

const store: SseStore = (() => {
  const g = globalThis as typeof globalThis & { __sseStore?: SseStore };
  if (!g.__sseStore) {
    g.__sseStore = { clients: new Map<number, SseClient>(), nextId: 1 };
  }
  return g.__sseStore;
})();

/** Serialize one SSE frame. `data` must already be a JSON string. */
function frame(event: string, data: string, id?: number): string {
  const idLine = id === undefined ? "" : `id: ${id}\n`;
  return `${idLine}event: ${event}\ndata: ${data}\n\n`;
}

export function addClient(res: Response): SseClient {
  const client: SseClient = { id: store.nextId++, res };
  store.clients.set(client.id, client);
  return client;
}

export function removeClient(id: number): void {
  store.clients.delete(id);
}

export function clientCount(): number {
  return store.clients.size;
}

/** Send one named event to a single client. Returns false if the write failed. */
export function sendToClient(
  client: SseClient,
  event: string,
  data: unknown,
  id?: number,
): boolean {
  try {
    client.res.write(frame(event, JSON.stringify(data), id));
    return true;
  } catch {
    removeClient(client.id);
    return false;
  }
}

/**
 * Broadcast to every connected visitor. Dead sockets are pruned as we go.
 * Never throws — a failing broadcast must not fail the CRUD request.
 */
export function broadcast(event: string, data: unknown): void {
  for (const client of store.clients.values()) {
    if (!sendToClient(client, event, data)) {
      store.clients.delete(client.id);
    }
  }
}
