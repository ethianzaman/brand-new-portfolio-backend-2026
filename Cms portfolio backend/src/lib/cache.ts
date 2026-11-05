// ── In-memory TTL cache (fast public reads, zero dependencies) ──
// Fine for one server. With several instances (PM2, Docker), replace it with
// Redis (e.g. ioredis): the interface stays the same.

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

const MAX_ENTRIES = 500;

const DEFAULT_TTL_MS = Number(process.env.CACHE_TTL_SECONDS ?? 30) * 1000;

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
  // Query strings make keys unbounded, so drop the oldest beyond the cap.
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheDelete(key: string): void {
  store.delete(key);
}

export function cacheDeletePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function cacheClear(): void {
  store.clear();
}