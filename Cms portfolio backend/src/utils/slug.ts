import type { Model, Types } from "mongoose";

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  URL slug helpers
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  Blog already generated slugs inline. Project and Service now need the same
 *  behaviour, so the logic lives here once.
 *
 *  Uniqueness strategy: MongoDB's unique index is the source of truth, but we
 *  also probe before insert to avoid a user-visible E11000 on a normal save.
 *  If a candidate collides, a short numeric suffix is appended; the probe is
 *  bounded so a pathological title can never spin forever.
 */

export function slugify(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Find a slug that is not yet taken on `Model`.
 *
 * `excludeId` lets an update ignore the document's own current slug so an
 * ordinary save is a no-op rather than a collision.
 */
export async function uniqueSlug(
  Model: Model<any>,
  base: string,
  excludeId?: string | Types.ObjectId,
): Promise<string> {
  const root = slugify(base) || "item";

  const taken = async (candidate: string): Promise<boolean> => {
    const query: Record<string, unknown> = { slug: candidate };
    if (excludeId) query._id = { $ne: excludeId };
    return Boolean(await Model.exists(query));
  };

  if (!(await taken(root))) return root;

  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${root}-${i}`;
    if (!(await taken(candidate))) return candidate;
  }

  // Extremely unlikely fallback — timestamp keeps it unique in practice.
  return `${root}-${Date.now()}`;
}
