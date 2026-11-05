import type { Response } from "express";

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  Server-Sent Events registry
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Every open stream is held here, on one of two channels:
 *
 *  - public: `/api/events`. `publishChange()` broadcasts here, and the public
 *    `LiveRefresh` component calls `router.refresh()` when it receives one, so
 *    a dashboard edit shows up on the visitor's open tab in about a second.
 *    Anyone can listen, so nothing private may ever be sent on it.
 *  - inbox: `/api/events/inbox`. Contact message details, for signed-in users
 *    with the messages.view permission only.
 *
 * Kept on `globalThis` so a nodemon restart in dev doesn't matter and so the
 * same registry instance is shared across modules.
 */

export type SseChannel = "public" | "inbox";

export interface SseClient {
  id: number;
  res: Response;
  /** Who the connection limit counts this against: an IP or a user. */
  owner: string;
  channel: SseChannel;
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

export function addClient(
  res: Response,
  owner: string,
  channel: SseChannel,
): SseClient {
  const client: SseClient = { id: store.nextId++, res, owner, channel };
  store.clients.set(client.id, client);
  return client;
}

export function removeClient(id: number): void {
  store.clients.delete(id);
}

let lastContentAt = 0;

/** When content last changed, so a reconnecting tab can tell it missed an edit. */
export function lastContentChange(): number {
  return lastContentAt;
}

export function clientsFrom(owner: string): number {
  let count = 0;
  for (const client of store.clients.values()) {
    if (client.owner === owner) count += 1;
  }
  return count;
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

function sendToChannel(channel: SseChannel, event: string, data: unknown): void {
  for (const client of store.clients.values()) {
    if (client.channel === channel && !sendToClient(client, event, data)) {
      store.clients.delete(client.id);
    }
  }
}

/**
 * Broadcast to every connected visitor. Dead sockets are pruned as we go.
 * Never throws — a failing broadcast must not fail the CRUD request.
 */
export function broadcast(event: string, data: unknown): void {
  if (event === "content") lastContentAt = Date.now();
  sendToChannel("public", event, data);
}

/** Broadcast to dashboard users allowed to read the inbox. */
export function broadcastInbox(event: string, data: unknown): void {
  sendToChannel("inbox", event, data);
}
