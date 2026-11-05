import { SiteSettings, SOCIAL_PLACEMENT_KEYS } from "../models/SiteSettings";
import type { ISiteSettings, SiteLogoType, SocialPlacements } from "../models/SiteSettings";
import { PageSeo, SEO_PAGE_KEYS, type SeoPageKey } from "../models/PageSeo";
import { uploadImage } from "../lib/cloudinary";
import { badRequest, HttpError } from "../lib/http";
import { publishChange } from "../lib/publish";
import { removeFileIfUnused } from "./file.service";
import { emptyPlacements } from "./socialLibrary.service";
import { isSafeCanonical, isSafeImage, requireValidSeo, serializeSeo } from "../utils/seo";

const TITLE_MAX = 120;
const TAGLINE_MAX = 160;
const ICON_MAX = 40;
const URL_MAX = 500;
const TITLE_TEMPLATE_MAX = 120;
const GLOBAL_DESC_MAX = 160;
const GLOBAL_TITLE_MAX = 70;
const TWITTER_MAX = 100;
const SITE_URL_MAX = 300;
const LOGO_TYPES: SiteLogoType[] = ["icon", "image"];

type Body = Record<string, any>;
export type SettingsDoc = ISiteSettings & { _id: unknown };

export function readPlacements(doc: SettingsDoc): SocialPlacements {
  const placements = emptyPlacements();
  for (const key of SOCIAL_PLACEMENT_KEYS) {
    placements[key] = [...(doc.socialPlacements?.[key] ?? [])];
  }
  return placements;
}

/** Always the neutral global-SEO shape, legacy documents included. */
function serializeSiteSeo(seo: unknown) {
  const raw = (seo ?? {}) as Record<string, unknown>;

  const text = (key: string, max: number): string => {
    const value = raw[key];
    return typeof value === "string" ? value.trim().slice(0, max) : "";
  };

  const template = raw.defaultTitleTemplate;

  return {
    defaultMetaTitle: text("defaultMetaTitle", GLOBAL_TITLE_MAX),
    defaultTitleTemplate:
      typeof template === "string" && template.trim()
        ? template.trim().slice(0, TITLE_TEMPLATE_MAX)
        : "%s",
    defaultMetaDescription: text("defaultMetaDescription", GLOBAL_DESC_MAX),
    defaultOgImage: text("defaultOgImage", URL_MAX),
    twitterHandle: text("twitterHandle", TWITTER_MAX),
    siteUrl: text("siteUrl", SITE_URL_MAX),
  };
}

export function serializeSettings(doc: SettingsDoc) {
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

export async function getOrCreateDoc(): Promise<SettingsDoc> {
  const doc =
    (await SiteSettings.findOne()) ??
    (await SiteSettings.create({
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
    }));

  return doc as unknown as SettingsDoc;
}

export async function getSettings() {
  return serializeSettings(await getOrCreateDoc());
}

export async function updateBrand(body: Body, file?: Express.Multer.File) {
  const { name, tagline, logoType, logoIcon, logoUrl } = body ?? {};

  const doc = await getOrCreateDoc();
  const previousLogoUrl = doc.brand?.logo?.url ?? "";
  const changes: Record<string, unknown> = {};

  if (name !== undefined) {
    const clean = String(name).trim().slice(0, TITLE_MAX);
    if (!clean) throw badRequest("Brand name is required");
    changes["brand.name"] = clean;
  }

  if (tagline !== undefined) {
    changes["brand.tagline"] = String(tagline).trim().slice(0, TAGLINE_MAX);
  }

  let nextType: SiteLogoType | undefined;
  if (logoType !== undefined) {
    if (!LOGO_TYPES.includes(logoType)) throw badRequest('logoType must be "icon" or "image"');
    nextType = logoType;
    changes["brand.logo.type"] = logoType;
  }

  if (logoIcon !== undefined) {
    const clean = String(logoIcon).trim().slice(0, ICON_MAX);
    if (!clean) throw badRequest("Logo icon is required");
    changes["brand.logo.icon"] = clean;
  }

  if (file) {
    if (!file.mimetype.startsWith("image/")) throw badRequest("Logo must be an image file");
    changes["brand.logo.url"] = await uploadImage(file.buffer, "portfolio_brand");
    changes["brand.logo.type"] = "image";
    nextType = "image";
  } else if (logoUrl !== undefined) {
    changes["brand.logo.url"] = String(logoUrl).trim().slice(0, URL_MAX);
  }

  // An "image" logo must actually resolve to a link once we are done.
  const effectiveType = nextType ?? doc.brand?.logo?.type ?? "icon";
  const effectiveUrl = (changes["brand.logo.url"] as string | undefined) ?? previousLogoUrl;
  if (effectiveType === "image" && !effectiveUrl) {
    throw badRequest("Logo image URL is required when the logo type is image");
  }

  if (Object.keys(changes).length === 0) throw badRequest("No valid fields to update");

  const updated = await SiteSettings.findByIdAndUpdate(
    doc._id,
    { $set: changes },
    { new: true, runValidators: true },
  );
  if (!updated) throw new HttpError(500, "Failed to update site settings");

  const logoUrlNow = updated.brand?.logo?.url ?? "";
  if (previousLogoUrl && previousLogoUrl !== logoUrlNow) {
    await removeFileIfUnused(previousLogoUrl);
  }

  await publishChange("settings");
  return serializeSettings(updated as unknown as SettingsDoc);
}

/**
 * Global defaults. Links follow the same policy as per-item SEO, so a bad value
 * can never reach <link rel="canonical"> or og:image.
 */
export async function updateSiteSeo(body: Body) {
  const input = body ?? {};

  const siteUrl = String(input.siteUrl ?? "").trim().slice(0, SITE_URL_MAX);
  if (siteUrl && !isSafeCanonical(siteUrl)) throw badRequest("siteUrl must be an https URL");

  const defaultOgImage = String(input.defaultOgImage ?? "").trim().slice(0, URL_MAX);
  if (defaultOgImage && !isSafeImage(defaultOgImage)) {
    throw badRequest("defaultOgImage must be an https URL or a same-site path");
  }

  // Exactly one `%s`, or a page title would be dropped or duplicated.
  const template = String(input.defaultTitleTemplate ?? "").trim();
  if (template && template.split("%s").length !== 2) {
    throw badRequest('defaultTitleTemplate must contain exactly one "%s" placeholder');
  }

  const doc = await getOrCreateDoc();
  const previousOgImage = doc.seo?.defaultOgImage;

  doc.seo = {
    defaultMetaTitle: String(input.defaultMetaTitle ?? "").trim().slice(0, GLOBAL_TITLE_MAX),
    defaultTitleTemplate: (template || "%s").slice(0, TITLE_TEMPLATE_MAX),
    defaultMetaDescription: String(input.defaultMetaDescription ?? "").trim().slice(0, GLOBAL_DESC_MAX),
    defaultOgImage,
    twitterHandle: String(input.twitterHandle ?? "").trim().slice(0, TWITTER_MAX),
    siteUrl,
  } as any;

  await (doc as any).save();
  await removeFileIfUnused(previousOgImage);

  await publishChange("settings");
  await publishChange("seo");
  return serializeSettings(doc);
}

/** One entry per known page, so the public resolver always has a full map. */
export async function getAllPageSeo() {
  const docs = await PageSeo.find().lean();

  const pages: Record<string, unknown> = {};
  for (const key of SEO_PAGE_KEYS) {
    pages[key] = serializeSeo(docs.find((d) => (d as any).page === key)?.seo);
  }
  return pages;
}

export async function updatePageSeo(page: SeoPageKey, body: Body) {
  if (!SEO_PAGE_KEYS.includes(page)) {
    throw badRequest(`page must be one of: ${SEO_PAGE_KEYS.join(", ")}`);
  }

  const seo = requireValidSeo(body?.seo ?? body);

  const previous = await PageSeo.findOne({ page }).lean();
  const doc = await PageSeo.findOneAndUpdate(
    { page },
    { $set: { page, seo } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  await removeFileIfUnused((previous as { seo?: { ogImage?: string } } | null)?.seo?.ogImage);

  await publishChange("seo");
  // The landing page's cache tag is "hero"; its Page SEO key stays "home".
  await publishChange(page === "home" ? "hero" : page);

  return serializeSeo(doc?.seo);
}
