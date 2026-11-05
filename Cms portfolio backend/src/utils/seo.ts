import type { ISeo } from "../models/shared/seoSchema";
import { SEO_FIELD_LIMITS } from "../models/shared/seoSchema";
import { badRequest } from "../lib/http";

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  SEO input normalisation + output serialisation
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  Two jobs, both security-relevant:
 *
 *  normaliseSeo(input)
 *    Turns arbitrary request input into a SAFE, WHITELISTED `ISeo` object.
 *    Unknown keys are dropped, strings are trimmed and length-capped, and
 *    URLs are validated against an explicit policy so a malicious value can
 *    never end up in `<link rel="canonical">` or `og:image`.
 *
 *  serializeSeo(doc)
 *    Turns a stored (possibly legacy/absent) `seo` subdocument into the exact
 *    neutral shape the frontend expects. Never returns `undefined`, so the
 *    public API contract is stable for documents written before this feature.
 */

const MAX_OG = SEO_FIELD_LIMITS.ogImage;
const MAX_CANONICAL = SEO_FIELD_LIMITS.canonicalUrl;
const MAX_TITLE = SEO_FIELD_LIMITS.metaTitle;
const MAX_DESCRIPTION = SEO_FIELD_LIMITS.metaDescription;

/** Absolute https URL, or a root-relative path ("/foo"), or empty. */
function isSafeAbsoluteOrPath(value: string): boolean {
  if (!value) return true;

  // Root-relative path (but NOT protocol-relative "//evil.com").
  if (value.startsWith("/")) {
    return !value.startsWith("//");
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Canonical URLs may be an absolute https URL OR a same-site path. A
 * canonical must never point at another host via http, javascript:, data:,
 * or a protocol-relative URL, so those are rejected outright.
 */
export function isSafeCanonical(value: string): boolean {
  return isSafeAbsoluteOrPath(value);
}

/** og:image must be an absolute https URL or a root-relative path. */
export function isSafeImage(value: string): boolean {
  return isSafeAbsoluteOrPath(value);
}

function cleanString(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function cleanBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return false;
}

export const EMPTY_SEO: ISeo = {
  metaTitle: "",
  metaDescription: "",
  ogImage: "",
  canonicalUrl: "",
  noindex: false,
  nofollow: false,
};

/**
 * Validate + whitelist raw SEO input.
 *
 * Returns `null` when a provided URL violates the policy, so the controller
 * can answer 400 instead of silently persisting a broken or hostile value.
 * A field that is absent or empty is always accepted.
 */
export function normaliseSeo(input: unknown): ISeo | null {
  if (input === undefined || input === null) return { ...EMPTY_SEO };

  // FormData sends the subdocument as a JSON string.
  let source: unknown = input;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return null;
    }
  }

  if (typeof source !== "object") return null;

  const raw = source as Record<string, unknown>;

  const canonicalUrl = cleanString(raw.canonicalUrl, MAX_CANONICAL);
  if (!isSafeCanonical(canonicalUrl)) return null;

  const ogImage = cleanString(raw.ogImage, MAX_OG);
  if (!isSafeImage(ogImage)) return null;

  return {
    metaTitle: cleanString(raw.metaTitle, MAX_TITLE),
    metaDescription: cleanString(raw.metaDescription, MAX_DESCRIPTION),
    ogImage,
    canonicalUrl,
    noindex: cleanBoolean(raw.noindex),
    nofollow: cleanBoolean(raw.nofollow),
  };
}

/** Always returns the neutral shape — safe for legacy documents and `lean()`. */
export function serializeSeo(doc: unknown): ISeo {
  if (!doc || typeof doc !== "object") return { ...EMPTY_SEO };

  const raw = doc as Record<string, unknown>;

  return {
    metaTitle: cleanString(raw.metaTitle, MAX_TITLE),
    metaDescription: cleanString(raw.metaDescription, MAX_DESCRIPTION),
    ogImage: cleanString(raw.ogImage, MAX_OG),
    canonicalUrl: cleanString(raw.canonicalUrl, MAX_CANONICAL),
    noindex: cleanBoolean(raw.noindex),
    nofollow: cleanBoolean(raw.nofollow),
  };
}

/** Validated SEO input, or a 400 when a link breaks the policy. */
export function requireValidSeo(input: unknown): ISeo {
  const seo = normaliseSeo(input);
  if (seo === null) {
    throw badRequest(
      "Invalid SEO data: canonicalUrl and ogImage must be https URLs or same-site paths",
    );
  }
  return seo;
}

/** A document (hydrated or lean) with its `seo` always in the full shape. */
export function withSeo(doc: unknown): Record<string, unknown> {
  if (doc === null || doc === undefined) {
    return { seo: serializeSeo(undefined) };
  }
  const plain =
    typeof (doc as any).toObject === "function"
      ? (doc as any).toObject()
      : (doc as Record<string, unknown>);
  return { ...plain, seo: serializeSeo((plain as any).seo) };
}

export function withSeoList(docs: unknown[]) {
  return docs.map((doc) => withSeo(doc));
}
