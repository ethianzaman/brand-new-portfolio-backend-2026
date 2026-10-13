"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addClient = addClient;
exports.removeClient = removeClient;
exports.clientCount = clientCount;
exports.sendToClient = sendToClient;
exports.broadcast = broadcast;
const store = (() => {
    const g = globalThis;
    if (!g.__sseStore) {
        g.__sseStore = { clients: new Map(), nextId: 1 };
    }
    return g.__sseStore;
})();
/** Serialize one SSE frame. `data` must already be a JSON string. */
function frame(event, data, id) {
    const idLine = id === undefined ? "" : `id: ${id}\n`;
    return `${idLine}event: ${event}\ndata: ${data}\n\n`;
}
function addClient(res) {
    const client = { id: store.nextId++, res };
    store.clients.set(client.id, client);
    return client;
}
function removeClient(id) {
    store.clients.delete(id);
}
function clientCount() {
    return store.clients.size;
}
/** Send one named event to a single client. Returns false if the write failed. */
function sendToClient(client, event, data, id) {
    try {
        client.res.write(frame(event, JSON.stringify(data), id));
        return true;
    }
    catch {
        removeClient(client.id);
        return false;
    }
}
/**
 * Broadcast to every connected visitor. Dead sockets are pruned as we go.
 * Never throws — a failing broadcast must not fail the CRUD request.
 */
function broadcast(event, data) {
    for (const client of store.clients.values()) {
        if (!sendToClient(client, event, data)) {
            store.clients.delete(client.id);
        }
    }
}
