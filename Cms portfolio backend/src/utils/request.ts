/** Copies only the named fields, so clients cannot set anything else. */
export function pick(
  source: Record<string, unknown> | undefined,
  keys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (source?.[key] !== undefined) out[key] = source[key];
  }
  return out;
}

/** http(s), a same-site path, or empty. Blocks `javascript:` and `data:`. */
export function isSafeLink(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value !== "string") return false;

  const link = value.trim();
  if (link === "#") return true;
  if (link.startsWith("/")) return !link.startsWith("//");
  return /^https?:\/\//i.test(link);
}

/** The first field holding an unsafe link, for the error message. */
export function firstUnsafeLink(
  source: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  return keys.find((key) => !isSafeLink(source[key])) ?? null;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The message a client may see. Validation problems are worth showing; anything
 * else can carry connection strings or file paths, so it goes to the log.
 */
export function publicMessage(err: unknown, fallback: string): string {
  const error = err as {
    name?: string;
    code?: number;
    statusCode?: number;
    message?: string;
  };

  if (error?.code === 11000) return "That value is already in use.";

  const isClientError =
    error?.name === "ValidationError" ||
    error?.name === "CastError" ||
    (typeof error?.statusCode === "number" &&
      error.statusCode >= 400 &&
      error.statusCode < 500);

  if (isClientError && error.message) return error.message;

  console.error(`[${fallback}]`, err);
  return fallback;
}

/** Links a visitor may be sent to: web, mail, phone and same-site. */
export function isAllowedHref(url: string): boolean {
  return /^(https?:\/\/|mailto:|tel:|#|\/)/.test(url);
}
