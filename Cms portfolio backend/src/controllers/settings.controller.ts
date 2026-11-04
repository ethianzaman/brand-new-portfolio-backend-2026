import { randomUUID } from "crypto";
import { Request, Response } from "express";
import { SiteSettings, SOCIAL_PLACEMENT_KEYS } from "../models/SiteSettings";
import type {
  ISiteSettings,
  ISiteSocial,
  SiteLogoType,
  SocialIconType,
  SocialPlacementKey,
  SocialPlacements,
} from "../models/SiteSettings";
import {
  deleteFromCloudinary,
  uploadImageToCloudinary,
  uploadToCloudinary,
} from "../middleware/uploadMiddleware";
import { publishChange } from "../lib/publish";
import { emptyPlacements, ensureSocialLibrary } from "../lib/socialLibrary";
import { normaliseSeo, serializeSeo, isSafeCanonical, isSafeImage } from "../utils/seo";
import { PageSeo, SEO_PAGE_KEYS, type SeoPageKey } from "../models/PageSeo";

const TITLE_MAX = 120;
const TAGLINE_MAX = 160;
const ICON_MAX = 40;
const URL_MAX = 500;
const LABEL_MAX = 50;
const DESCRIPTION_MAX = 120;
const MAX_SOCIALS = 30;
const SOCIAL_LOGO_FOLDER = "portfolio_socials";

const LOGO_TYPES: SiteLogoType[] = ["icon", "image"];

type SettingsDoc = ISiteSettings & { _id: unknown };

function readPlacements(doc: SettingsDoc): SocialPlacements {
  const placements = emptyPlacements();
  for (const key of SOCIAL_PLACEMENT_KEYS) {
    placements[key] = [...(doc.socialPlacements?.[key] ?? [])];
  }
  return placements;
}

/** Map the Mongoose document to the public `settings` envelope shape. */
function serializeSettings(doc: SettingsDoc) {
  const logo = doc.brand?.logo ?? { type: "icon", icon: "zap", url: "" };

  return {
    id: String(doc._id),
    brand: {
      name: doc.brand?.name ?? "",
      tagline: doc.brand?.tagline ?? "",
      logo: {
        type: logo.type === "image" ? "image" : "icon",
        icon: logo.icon || "zap",
        url: logo.url ?? "",
      },
    },
    socials: (doc.socials ?? []).map((social, index) => {
      const isImage = social.iconType === "image" && Boolean(social.imageUrl);
      return {
        id: social.id || `legacy-${index}`,
        label: social.label ?? "",
        href: social.href ?? "",
        icon: social.icon || "link",
        iconType: isImage ? "image" : "icon",
        imageUrl: isImage ? social.imageUrl : "",
        description: social.description ?? "",
      };
    }),
    socialPlacements: readPlacements(doc),
    socialsConfigured: doc.socialsConfigured === true,
    seo: serializeSiteSeo(doc.seo),
  };
}

const TITLE_TEMPLATE_MAX = 120;
const GLOBAL_DESC_MAX = 160;
const GLOBAL_TITLE_MAX = 70;
const TWITTER_MAX = 100;
const SITE_URL_MAX = 300;

/** Always returns the neutral global-SEO shape (legacy docs included). */
function serializeSiteSeo(seo: unknown) {
  const raw = (seo ?? {}) as Record<string, unknown>;

  const pick = (key: string, max: number): string => {
    const value = raw[key];
    return typeof value === "string" ? value.trim().slice(0, max) : "";
  };

  const template = raw.defaultTitleTemplate;

  return {
    defaultMetaTitle: pick("defaultMetaTitle", GLOBAL_TITLE_MAX),
    defaultTitleTemplate:
      typeof template === "string" && template.trim()
        ? template.trim().slice(0, TITLE_TEMPLATE_MAX)
        : "%s",
    defaultMetaDescription: pick("defaultMetaDescription", GLOBAL_DESC_MAX),
    defaultOgImage: pick("defaultOgImage", 500),
    twitterHandle: pick("twitterHandle", TWITTER_MAX),
    siteUrl: pick("siteUrl", SITE_URL_MAX),
  };
}

/** `https://` (or mailto/tel/#//) — same rule the home controller enforces. */
function isValidUrl(url: string): boolean {
  return /^(https?:\/\/|mailto:|tel:|#|\/)/.test(url);
}

/** Parse the socials list from either JSON (FormData) or a real array. */
async function getOrCreateDoc(): Promise<SettingsDoc> {
  let doc = await SiteSettings.findOne();

  if (!doc) {
    doc = await SiteSettings.create({
      brand: {
        name: "Ethian",
        tagline: "Full Stack Engineer",
        logo: { type: "icon", icon: "zap", url: "" },
      },
      socials: [
        { id: "legacy-0", label: "GitHub", href: "https://github.com", icon: "github" },
        { id: "legacy-1", label: "LinkedIn", href: "https://linkedin.com", icon: "linkedin" },
        { id: "legacy-2", label: "Twitter", href: "https://twitter.com", icon: "twitter" },
      ],
      socialPlacements: {
        navbar: ["legacy-0", "legacy-1", "legacy-2"],
        mobileMenu: ["legacy-0", "legacy-1", "legacy-2"],
        footer: ["legacy-0", "legacy-1", "legacy-2"],
      },
      socialsConfigured: true,
    });
  }

  return doc as unknown as SettingsDoc;
}

// ── GET /api/settings — public ─────────────────────────────────────────────────
export async function getSiteSettings(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const doc = await getOrCreateDoc();

    res.status(200).json({
      success: true,
      settings: serializeSettings(doc),
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "Server error",
    });
  }
}

// ── PUT /api/settings/brand — update brand name + logo (FormData) ──────────────
export async function updateBrand(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { name, tagline, logoType, logoIcon, logoUrl } = req.body ?? {};
    const file = req.file;

    const doc = await getOrCreateDoc();
    const oldLogoUrl = doc.brand?.logo?.url ?? "";

    const updateFields: Record<string, unknown> = {};

    // ── Name ──────────────────────────────────────────────────────────────────
    if (name !== undefined) {
      const clean = String(name).trim().slice(0, TITLE_MAX);
      if (!clean) {
        res.status(400).json({
          success: false,
          message: "Brand name is required",
        });
        return;
      }
      updateFields["brand.name"] = clean;
    }

    // ── Tagline ───────────────────────────────────────────────────────────────
    if (tagline !== undefined) {
      updateFields["brand.tagline"] = String(tagline)
        .trim()
        .slice(0, TAGLINE_MAX);
    }

    // ── Logo type ─────────────────────────────────────────────────────────────
    let nextType: SiteLogoType | undefined;
    if (logoType !== undefined) {
      if (!LOGO_TYPES.includes(logoType)) {
        res.status(400).json({
          success: false,
          message: 'logoType must be "icon" or "image"',
        });
        return;
      }
      nextType = logoType;
      updateFields["brand.logo.type"] = logoType;
    }

    // ── Logo icon ─────────────────────────────────────────────────────────────
    if (logoIcon !== undefined) {
      const clean = String(logoIcon).trim().slice(0, ICON_MAX);
      if (!clean) {
        res.status(400).json({
          success: false,
          message: "Logo icon is required",
        });
        return;
      }
      updateFields["brand.logo.icon"] = clean;
    }

    // ── Logo image ────────────────────────────────────────────────────────────
    if (file) {
      if (!file.mimetype.startsWith("image/")) {
        res.status(400).json({
          success: false,
          message: "Logo must be an image file",
        });
        return;
      }

      const uploadedUrl = await uploadToCloudinary(file.buffer, "portfolio_brand");
      updateFields["brand.logo.url"] = uploadedUrl;
      updateFields["brand.logo.type"] = "image";
      nextType = "image";
    } else if (logoUrl !== undefined) {
      updateFields["brand.logo.url"] = String(logoUrl).trim().slice(0, URL_MAX);
    }

    // An "image" logo must actually resolve to a URL once we are done.
    const effectiveType = nextType ?? doc.brand?.logo?.type ?? "icon";
    const effectiveUrl =
      (updateFields["brand.logo.url"] as string | undefined) ??
      doc.brand?.logo?.url ??
      "";

    if (effectiveType === "image" && !effectiveUrl) {
      res.status(400).json({
        success: false,
        message: "Logo image URL is required when the logo type is image",
      });
      return;
    }

    if (Object.keys(updateFields).length === 0) {
      res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
      return;
    }

    const updated = await SiteSettings.findByIdAndUpdate(
      doc._id,
      { $set: updateFields },
      { new: true, runValidators: true },
    );

    if (!updated) {
      res.status(500).json({
        success: false,
        message: "Failed to update site settings",
      });
      return;
    }

    // Housekeeping: remove the previous Cloudinary asset when it was replaced.
    const newLogoUrl = updated.brand?.logo?.url ?? "";
    if (oldLogoUrl && oldLogoUrl !== newLogoUrl) {
      await deleteFromCloudinary(oldLogoUrl);
    }

    await publishChange("settings");

    res.status(200).json({
      success: true,
      settings: serializeSettings(updated as unknown as SettingsDoc),
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "Server error",
    });
  }
}

// ── Social link library ─────────────────────────────────────────────────

type SocialInput = {
  label: string;
  href: string;
  icon: string;
  iconType: SocialIconType;
  description: string;
};

/** Validates a create/update body, or returns the message to show the admin. */
function parseSocialInput(body: Record<string, unknown>): SocialInput | string {
  const label = String(body.label ?? "").trim();
  const href = String(body.href ?? "").trim();

  if (!label) return "Label is required";
  if (!href) return "URL is required";
  if (!isValidUrl(href)) {
    return "URL must start with https://, http://, mailto:, tel:, # or /";
  }

  return {
    label: label.slice(0, LABEL_MAX),
    href: href.slice(0, URL_MAX),
    icon: String(body.icon ?? "link").trim().slice(0, ICON_MAX) || "link",
    iconType: body.iconType === "image" ? "image" : "icon",
    description: String(body.description ?? "").trim().slice(0, DESCRIPTION_MAX),
  };
}

/** Cloudinary answers 400 for a file that is not really an image. */
function uploadFailureStatus(err: unknown): number {
  return (err as { statusCode?: number }).statusCode === 400 ? 400 : 500;
}

function badRequest(res: Response, message: string): void {
  res.status(400).json({ success: false, message });
}

function sendSettings(res: Response, status: number, doc: SettingsDoc): void {
  res.status(status).json({ success: true, settings: serializeSettings(doc) });
}

// ── POST /api/settings/socials/setup — merge the old lists into the library ──
export async function setupSocialLibrary(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const doc = await getOrCreateDoc();
    await ensureSocialLibrary(doc);
    await doc.save();

    await publishChange("settings");
    sendSettings(res, 200, doc);
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "Failed to set up the library",
    });
  }
}

// ── POST /api/settings/socials — add a link (FormData: optional `logo` file) ──
export async function createSocial(req: Request, res: Response): Promise<void> {
  let uploadedUrl = "";

  try {
    const input = parseSocialInput(req.body ?? {});
    if (typeof input === "string") return badRequest(res, input);
    if (input.iconType === "image" && !req.file) {
      return badRequest(res, "Choose a logo image to upload");
    }

    const doc = await getOrCreateDoc();
    await ensureSocialLibrary(doc);

    if (doc.socials.length >= MAX_SOCIALS) {
      return badRequest(res, `Maximum ${MAX_SOCIALS} social links allowed`);
    }

    if (input.iconType === "image" && req.file) {
      uploadedUrl = await uploadImageToCloudinary(req.file.buffer, SOCIAL_LOGO_FOLDER);
    }

    (doc.socials as ISiteSocial[]).push({
      ...input,
      id: randomUUID(),
      imageUrl: uploadedUrl,
    });
    await doc.save();

    await publishChange("settings");
    sendSettings(res, 201, doc);
  } catch (err: unknown) {
    if (uploadedUrl) await deleteFromCloudinary(uploadedUrl);
    res.status(uploadFailureStatus(err)).json({
      success: false,
      message: err instanceof Error ? err.message : "Failed to add the social link",
    });
  }
}

// ── PUT /api/settings/socials/:id — edit a link (FormData: optional `logo`) ──
export async function updateSocial(req: Request, res: Response): Promise<void> {
  let uploadedUrl = "";

  try {
    const input = parseSocialInput(req.body ?? {});
    if (typeof input === "string") return badRequest(res, input);

    const doc = await getOrCreateDoc();
    await ensureSocialLibrary(doc);

    const social = (doc.socials as ISiteSocial[]).find(
      (item) => item.id === req.params.id,
    );
    if (!social) {
      res.status(404).json({ success: false, message: "Social link not found" });
      return;
    }

    const previousUrl = social.imageUrl;
    if (input.iconType === "image" && !req.file && !previousUrl) {
      return badRequest(res, "Choose a logo image to upload");
    }

    if (input.iconType === "image" && req.file) {
      uploadedUrl = await uploadImageToCloudinary(req.file.buffer, SOCIAL_LOGO_FOLDER);
    }

    const nextUrl = input.iconType === "image" ? uploadedUrl || previousUrl : "";
    Object.assign(social, input, { imageUrl: nextUrl });
    await doc.save();

    // The database no longer points at the old file, so it is safe to remove.
    if (previousUrl && previousUrl !== nextUrl) {
      await deleteFromCloudinary(previousUrl);
    }

    await publishChange("settings");
    sendSettings(res, 200, doc);
  } catch (err: unknown) {
    if (uploadedUrl) await deleteFromCloudinary(uploadedUrl);
    res.status(uploadFailureStatus(err)).json({
      success: false,
      message: err instanceof Error ? err.message : "Failed to update the social link",
    });
  }
}

// ── DELETE /api/settings/socials/:id — removes it from every section too ────
export async function deleteSocial(req: Request, res: Response): Promise<void> {
  try {
    const doc = await getOrCreateDoc();
    await ensureSocialLibrary(doc);

    const socials = doc.socials as ISiteSocial[];
    const social = socials.find((item) => item.id === req.params.id);
    if (!social) {
      res.status(404).json({ success: false, message: "Social link not found" });
      return;
    }

    const imageUrl = social.imageUrl;
    doc.socials = socials.filter((item) => item.id !== social.id) as any;

    const current = readPlacements(doc);
    for (const key of SOCIAL_PLACEMENT_KEYS) {
      current[key] = current[key].filter((id) => id !== social.id);
    }
    doc.socialPlacements = current;
    await doc.save();

    if (imageUrl) await deleteFromCloudinary(imageUrl);

    await publishChange("settings");
    sendSettings(res, 200, doc);
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "Failed to delete the social link",
    });
  }
}

// ── PUT /api/settings/social-placements — which links each section shows ────
export async function updateSocialPlacements(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const raw = req.body?.placements;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return badRequest(res, "placements must be an object");
    }

    const unknownKey = Object.keys(raw).find(
      (key) => !SOCIAL_PLACEMENT_KEYS.includes(key as SocialPlacementKey),
    );
    if (unknownKey) return badRequest(res, `Unknown section: ${unknownKey}`);

    const doc = await getOrCreateDoc();
    await ensureSocialLibrary(doc);

    const validIds = new Set((doc.socials as ISiteSocial[]).map((item) => item.id));
    const next = readPlacements(doc);

    for (const key of Object.keys(raw) as SocialPlacementKey[]) {
      const ids: unknown = raw[key];
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
        return badRequest(res, `${key} must be a list of link ids`);
      }

      const missing = ids.find((id) => !validIds.has(id));
      if (missing) {
        return badRequest(res, `${key} refers to a link that no longer exists`);
      }

      next[key] = [...new Set(ids as string[])];
    }

    doc.socialPlacements = next;
    await doc.save();

    await publishChange("settings");
    sendSettings(res, 200, doc);
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "Failed to update the sections",
    });
  }
}

// ── PUT /api/settings/seo — global SEO defaults ────────────────────────────────
//
// Global defaults own the title template + canonical origin, which only make
// sense once for the whole site. `siteUrl` and `defaultOgImage` are validated
// against the same URL policy as per-item SEO so a bad value can never reach
// <link rel="canonical"> or og:image.
export async function updateSeo(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const body = req.body ?? {};

    const siteUrl = String(body.siteUrl ?? "").trim().slice(0, SITE_URL_MAX);
    if (siteUrl && !isSafeCanonical(siteUrl)) {
      res.status(400).json({
        success: false,
        message: "siteUrl must be an https URL",
      });
      return;
    }

    const defaultOgImage = String(body.defaultOgImage ?? "")
      .trim()
      .slice(0, 500);
    if (defaultOgImage && !isSafeImage(defaultOgImage)) {
      res.status(400).json({
        success: false,
        message: "defaultOgImage must be an https URL or a same-site path",
      });
      return;
    }

    const template = String(body.defaultTitleTemplate ?? "").trim();
    // A usable template MUST contain exactly one `%s` placeholder, otherwise a
    // page title would either be dropped or duplicated.
    if (template && template.split("%s").length !== 2) {
      res.status(400).json({
        success: false,
        message: 'defaultTitleTemplate must contain exactly one "%s" placeholder',
      });
      return;
    }

    const doc = await getOrCreateDoc();

    doc.seo = {
      defaultMetaTitle: String(body.defaultMetaTitle ?? "")
        .trim()
        .slice(0, GLOBAL_TITLE_MAX),
      defaultTitleTemplate: (template || "%s").slice(0, TITLE_TEMPLATE_MAX),
      defaultMetaDescription: String(body.defaultMetaDescription ?? "")
        .trim()
        .slice(0, GLOBAL_DESC_MAX),
      defaultOgImage,
      twitterHandle: String(body.twitterHandle ?? "")
        .trim()
        .slice(0, TWITTER_MAX),
      siteUrl,
    } as any;

    await doc.save();

    await publishChange("settings");
    await publishChange("seo");

    res.status(200).json({
      success: true,
      settings: serializeSettings(doc),
    });
  } catch (err: unknown) {
    res.status(400).json({
      success: false,
      message: err instanceof Error ? err.message : "Failed to update SEO",
    });
  }
}

// ── GET /api/settings/pages/seo — all static-page SEO overrides ────────────────
//
// Returns one entry per known page key with the neutral shape when unset, so
// the public resolver always has a complete map.
export async function getPageSeo(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const docs = await PageSeo.find().lean();

    const byPage: Record<string, unknown> = {};
    for (const key of SEO_PAGE_KEYS) {
      byPage[key] = serializeSeo(
        docs.find((d) => (d as any).page === key)?.seo,
      );
    }

    res.status(200).json({ success: true, pages: byPage });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "Server error",
    });
  }
}

// ── PUT /api/settings/pages/seo/:page — upsert one page's SEO override ─────────
export async function updatePageSeo(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const page = req.params.page as SeoPageKey;

    if (!SEO_PAGE_KEYS.includes(page)) {
      res.status(400).json({
        success: false,
        message: `page must be one of: ${SEO_PAGE_KEYS.join(", ")}`,
      });
      return;
    }

    const seo = normaliseSeo(req.body?.seo ?? req.body);
    if (seo === null) {
      res.status(400).json({
        success: false,
        message:
          "Invalid SEO data: canonicalUrl and ogImage must be https URLs or same-site paths",
      });
      return;
    }

    const doc = await PageSeo.findOneAndUpdate(
      { page },
      { $set: { page, seo } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    await publishChange("seo");
    await publishChange(page);

    res.status(200).json({
      success: true,
      page,
      seo: serializeSeo(doc?.seo),
    });
  } catch (err: unknown) {
    res.status(400).json({
      success: false,
      message: err instanceof Error ? err.message : "Failed to update page SEO",
    });
  }
}
