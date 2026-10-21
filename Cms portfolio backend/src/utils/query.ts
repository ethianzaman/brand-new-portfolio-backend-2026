/**
 * Shared helpers for the paginated + searchable list endpoints.
 *
 * Every list endpoint (blogs / projects / services) parses the same handful of
 * query parameters, so the parsing lives here once instead of being
 * re-implemented (and re-bugged) in three controllers.
 */

/** Hard ceiling on any single page. Protects the DB from `?pageSize=99999`. */
export const MAX_PAGE_SIZE = 100;

/** Default page size for the dashboard lists. */
export const DEFAULT_PAGE_SIZE = 10;

/**
 * Upper bound on how long a single list query may run on the server.
 *
 * Search is a regex match, which cannot use an index for arbitrary substrings
 * and therefore degrades into a collection scan on large datasets. `maxTimeMS`
 * makes that failure mode explicit: the query is aborted and the API answers
 * with a 503 instead of pinning a connection until the request times out.
 */
export const MAX_QUERY_TIME_MS = 2000;

/**
 * Parse an integer query parameter, clamped into `[min, max]`.
 * Anything unparseable falls back to `fallback`.
 */
export function clampInt(
  raw: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number.parseInt(String(raw ?? ""), 10);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(Math.max(parsed, min), max);
}

/**
 * Build a case-insensitive regex from a user-supplied search term.
 *
 * The term is escaped, so a user typing `c++` or `(a|b)` searches for that
 * literal text instead of being able to inject a pattern. Escaping also stops
 * a pathological term from becoming a catastrophic-backtracking regex.
 *
 * Returns `null` for an empty term — callers treat that as "no filter".
 */
export function buildSearchRegex(raw: unknown): RegExp | null {
  const term = typeof raw === "string" ? raw.trim() : "";

  if (!term) return null;

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(escaped, "i");
}

/**
 * Resolve the `sort` / `dir` query parameters into a Mongoose sort spec.
 *
 * `allowed` is the whitelist of sortable fields. A field that is not on the
 * whitelist is ignored (and `fallback` is used) so a caller can never ask
 * MongoDB to sort by an arbitrary or injected key.
 */
export function resolveSort(
  field: unknown,
  dir: unknown,
  allowed: readonly string[],
  fallback: Record<string, 1 | -1>,
): Record<string, 1 | -1> {
  const key = typeof field === "string" ? field : "";

  if (!allowed.includes(key)) return fallback;

  const sign = dir === "desc" ? -1 : 1;

  return { [key]: sign as 1 | -1 };
}

/**
 * Build the `{ total, hasMore, page, pageSize }` pagination envelope shared by
 * every list endpoint.
 */
export function buildPageMeta(
  rows: unknown[],
  total: number,
  page: number,
  pageSize: number,
) {
  const offset = (page - 1) * pageSize;

  return {
    total,
    hasMore: offset + rows.length < total,
    page,
    pageSize,
  };
}
