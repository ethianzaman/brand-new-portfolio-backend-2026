import { cloudinary } from "../lib/cloudinary";

import { About } from "../models/About";
import { Blog } from "../models/Blog";
import { Hero } from "../models/Hero";
import { PageSeo } from "../models/PageSeo";
import { Project } from "../models/Project";
import { Service } from "../models/Service";
import { SiteSettings } from "../models/SiteSettings";
import { SkillCategory } from "../models/Skill";
import { escapeRegExp } from "../utils/request";

const CLOUDINARY_FILE =
  /^https:\/\/res\.cloudinary\.com\/([^/]+)\/(image|raw|video)\/upload\/([^?#]+)$/i;

/** Where a link points in this account. Anything else is never ours to delete. */
function parseFile(url: unknown): { publicId: string; resourceType: string } | null {
  if (typeof url !== "string") return null;
  const match = CLOUDINARY_FILE.exec(url.trim());
  if (!match || match[1] !== process.env.CLOUDINARY_CLOUD_NAME) return null;

  const [, , resourceType, rest] = match;
  const versioned = /(?:^|\/)v\d+\/(.+)$/.exec(rest);
  // Without a version, a leading segment with a comma is a transformation.
  const path = versioned ? versioned[1] : rest.replace(/^[^/]*,[^/]*\//, "");

  return {
    // A raw file keeps its extension in its id; an image or video does not.
    publicId: resourceType === "raw" ? path : path.replace(/\.[^/.]+$/, ""),
    resourceType,
  };
}

/** Matched by id, so a resized or re-versioned link to the same file counts. */
async function isFileInUse(publicId: string): Promise<boolean> {
  const pointsAtFile = new RegExp(`${escapeRegExp(publicId)}(?:[.?#]|$)`);
  const usedIn = (...fields: string[]) => ({
    $or: fields.map((field) => ({ [field]: pointsAtFile })),
  });

  const found = await Promise.all([
    About.exists(usedIn("hero.image", "hero.resumeUrl")),
    Hero.exists(usedIn("hero.image", "hero.resumeUrl")),
    Blog.exists(usedIn("coverImage", "seo.ogImage", "content")),
    Project.exists(usedIn("thumbnail", "images", "seo.ogImage", "gallery")),
    Service.exists(usedIn("seo.ogImage")),
    SkillCategory.exists(usedIn("skills.icon")),
    PageSeo.exists(usedIn("seo.ogImage")),
    SiteSettings.exists(
      usedIn("brand.logo.url", "socials.imageUrl", "seo.defaultOgImage"),
    ),
  ]);
  return found.some(Boolean);
}

/**
 * The one way an uploaded file leaves Cloudinary. Call it with the old link
 * AFTER the new one is saved: if an upload or a save fails, the live file is
 * still there. A file that any other section still uses is kept. Saving never
 * fails because of this, so errors are only logged, and the file stays.
 */
export async function removeFileIfUnused(url: unknown): Promise<void> {
  try {
    const file = parseFile(url);
    if (!file || (await isFileInUse(file.publicId))) return;
    await cloudinary.uploader.destroy(file.publicId, {
      resource_type: file.resourceType,
      invalidate: true,
    });
  } catch (err) {
    console.error(
      "Could not delete an old file:",
      err instanceof Error ? err.message : "unknown error",
    );
  }
}

const OG_IMAGE_URL =
  /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:[^/]*,[^/]*\/)?(?:v\d+\/)?portfolio\/og\/[^/?#.]+\.[a-z0-9]+$/i;

/**
 * For links a browser sends directly, which only ever name a share image. The
 * form saves go through removeFileIfUnused like any other file.
 */
export async function removeOgImageIfUnused(url: unknown): Promise<void> {
  if (typeof url === "string" && OG_IMAGE_URL.test(url.trim())) {
    await removeFileIfUnused(url);
  }
}
