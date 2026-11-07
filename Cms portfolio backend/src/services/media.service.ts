import { uploadImage } from "../lib/cloudinary";
import { badRequest } from "../lib/http";
import { isSafeImage } from "../utils/seo";
import { removeFileIfUnused } from "./file.service";

/**
 * Ordered image lists (a project's card images, its screenshots) sent from a
 * form. The form sends the final order as tokens: a saved link stays as it is,
 * and `upload:N` stands for the Nth file uploaded under the same field name.
 *
 *   cardImages = ["https://…/a.png", "upload:0", "https://…/b.png"]
 *
 * Planning checks everything before a single byte goes to Cloudinary, so a
 * rejected request leaves nothing behind.
 */

const UPLOAD_TOKEN = /^upload:(\d+)$/;

export interface ImageListPlan {
  /** Final order: a saved link, or the index of an uploaded file. */
  order: (string | number)[];
  files: Express.Multer.File[];
  folder: string;
}

/** A list sent as an array, as JSON (FormData), or as one item per line. */
export function readList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw !== "string") return [];
  const text = raw.trim();
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      throw badRequest("The list could not be read");
    }
  }
  return text.split(/\r?\n/);
}

/**
 * Validates a list without uploading. Undefined when the request touched
 * neither the list nor its files, so the saved list stays as it is. Files the
 * order doesn't mention go at the end, which is also how a plain upload with
 * no order adds to `current`.
 */
export function planImageList(
  raw: unknown,
  files: Express.Multer.File[] = [],
  current: string[],
  { max, folder, label }: { max: number; folder: string; label: string },
): ImageListPlan | undefined {
  if (raw === undefined && files.length === 0) return undefined;

  const tokens = raw === undefined ? current : readList(raw).map((t) => t.trim()).filter(Boolean);
  const used = new Set<number>();
  const order: (string | number)[] = tokens.map((token) => {
    const upload = UPLOAD_TOKEN.exec(token);
    if (upload) {
      const index = Number(upload[1]);
      if (index >= files.length || used.has(index)) throw badRequest(`${label}: unknown upload`);
      used.add(index);
      return index;
    }
    if (!isSafeImage(token)) throw badRequest(`${label} must be https links or same-site paths`);
    return token;
  });
  files.forEach((_, index) => {
    if (!used.has(index)) order.push(index);
  });

  if (order.length > max) throw badRequest(`Up to ${max} ${label.toLowerCase()}`);
  return { order, files, folder };
}

/**
 * Uploads the plan's files side by side and returns the final links. Every new
 * link is added to `uploaded`, so the caller can remove them if saving fails.
 */
export async function resolveImageList(plan: ImageListPlan, uploaded: string[]): Promise<string[]> {
  const links = await Promise.all(
    plan.files.map(async (file) => {
      const link = await uploadImage(file.buffer, plan.folder);
      uploaded.push(link);
      return link;
    }),
  );
  return plan.order.map((item) => (typeof item === "number" ? links[item] : item));
}

/** Removes files that are no longer used anywhere. Never throws. */
export async function removeFilesIfUnused(urls: (string | null | undefined)[]): Promise<void> {
  const unique = [...new Set(urls.filter((url): url is string => Boolean(url)))];
  await Promise.all(unique.map((url) => removeFileIfUnused(url)));
}
