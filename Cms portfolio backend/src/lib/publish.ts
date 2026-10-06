import { broadcast } from "./sse";

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  publishChange — the one call every write controller makes
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Call it at the END of a create/update/delete, after the DB save succeeded
 * and BEFORE `res.json()`:
 *
 *     await doc.save();
 *     await publishChange("home");
 *     res.json({ success: true, ... });
 *
 * Order matters, and it is deliberate:
 *   1. revalidate the Next.js cache tag  → the next render already has new data
 *   2. broadcast the SSE event           → visitors refresh into that new data
 *
 * If we broadcasted first, a visitor could refresh into a stale cached page.
 *
 * The revalidate step is best-effort: if Next is restarting, deploying or down,
 * we log and carry on. A CRUD request must NEVER fail because the frontend
 * cache could not be invalidated — the 60s ISR window will pick it up anyway.
 *
 * Tags must match the frontend exactly: home, about, contact, skills,
 * projects, blog, and `blog-${slug}` for a single post.
 */

const REVALIDATE_TIMEOUT_MS = 3000;

function frontendUrl(): string | null {
  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) return null;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

async function revalidateTag(tag: string): Promise<boolean> {
  const base = frontendUrl();
  if (!base) {
    console.warn(
      "[publish] FRONTEND_URL is not set — skipping cache revalidation",
    );
    return false;
  }

  const secret = process.env.REVALIDATE_SECRET?.trim() ?? "";

  try {
    const res = await fetch(`${base}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "x-revalidate-secret": secret } : {}),
      },
      body: JSON.stringify({ tag }),
      signal: AbortSignal.timeout(REVALIDATE_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(
        `[publish] revalidate "${tag}" → HTTP ${res.status} (ignored)`,
      );
      return false;
    }
    return true;
  } catch (error) {
    // Swallowed on purpose: never break a successful DB write.
    console.warn(
      `[publish] revalidate "${tag}" failed (ignored):`,
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

export async function publishChange(tag: string): Promise<void> {
  // 1️⃣  Drop the Next.js cache entry for this tag.
  await revalidateTag(tag);

  // 2️⃣  Tell every open public tab to refresh.
  broadcast("content", { tag, at: Date.now() });
}
