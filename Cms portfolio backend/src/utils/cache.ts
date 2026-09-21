// ── In-memory TTL cache (fast public reads, zero dependencies) ──
// Multiple server instances চালালে (production PM2/Docker) shipment-এ
// Redis (e.g. ioredis) দিয়ে replace করা যাবে — ইন্টারফেস একই থাকবে।

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = Number(process.env.HOME_CACHE_TTL ?? 30) * 1000;

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheDelete(key: string): void {
  store.delete(key);
}

export function cacheClear(): void {
  store.clear();
}