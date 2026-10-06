"use strict";
// ── In-memory TTL cache (fast public reads, zero dependencies) ──
// Multiple server instances চালালে (production PM2/Docker) shipment-এ
// Redis (e.g. ioredis) দিয়ে replace করা যাবে — ইন্টারফেস একই থাকবে।
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheGet = cacheGet;
exports.cacheSet = cacheSet;
exports.cacheDelete = cacheDelete;
exports.cacheClear = cacheClear;
const store = new Map();
const DEFAULT_TTL_MS = Number(process.env.HOME_CACHE_TTL ?? 30) * 1000;
function cacheGet(key) {
    const entry = store.get(key);
    if (!entry)
        return undefined;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
    }
    return entry.value;
}
function cacheSet(key, value, ttlMs = DEFAULT_TTL_MS) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
}
function cacheDelete(key) {
    store.delete(key);
}
function cacheClear() {
    store.clear();
}
