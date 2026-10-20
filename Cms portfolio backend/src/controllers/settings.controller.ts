import { Request, Response } from "express";
import { SiteSettings } from "../models/SiteSettings";
import type {
  ISiteSettings,
  ISiteSocial,
  SiteLogoType,
} from "../models/SiteSettings";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../middleware/uploadMiddleware";
import { publishChange } from "../lib/publish";

const TITLE_MAX = 120;
const TAGLINE_MAX = 160;
const ICON_MAX = 40;
const URL_MAX = 500;
const LABEL_MAX = 50;
const MAX_SOCIALS = 12;

const LOGO_TYPES: SiteLogoType[] = ["icon", "image"];

type SettingsDoc = ISiteSettings & { _id: unknown };

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
    socials: (doc.socials ?? []).map((social) => ({
      label: social.label ?? "",
      href: social.href ?? "",
      icon: social.icon || "link",
    })),
  };
}

/** `https://` (or mailto/tel/#//) — same rule the home controller enforces. */
function isValidUrl(url: string): boolean {
  return /^(https?:\/\/|mailto:|tel:|#|\/)/.test(url);
}

/** Parse the socials list from either JSON (FormData) or a real array. */
function parseSocials(raw: unknown): ISiteSocial[] | null {
  let list: unknown = raw;

  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(list)) return null;

  const socials: ISiteSocial[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") return null;

    const label = String((item as any).label ?? "").trim();
    const href = String((item as any).href ?? "").trim();
    const icon = String((item as any).icon ?? "link").trim() || "link";

    // Skip blank rows (leftovers from "Add link"), but reject half-filled ones.
    if (!label && !href) continue;

    if (!label || !href) return null;
    if (!isValidUrl(href)) return null;

    socials.push({
      label: label.slice(0, LABEL_MAX),
      href: href.slice(0, URL_MAX),
      icon: icon.slice(0, ICON_MAX),
    });
  }

  return socials;
}

/**
 * Singleton accessor — same get-or-create idea as the Contact/Home controllers.
 * Defaults seed the currently shipped brand + socials so the public site keeps
 * rendering exactly as before until an admin changes it.
 */
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
        { label: "GitHub", href: "https://github.com", icon: "github" },
        { label: "LinkedIn", href: "https://linkedin.com", icon: "linkedin" },
        { label: "Twitter", href: "https://twitter.com", icon: "twitter" },
      ],
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

// ── PUT /api/settings/socials — replace the shared social links list ───────────
export async function updateSocials(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const parsed = parseSocials(req.body?.socials);

    if (!parsed) {
      res.status(400).json({
        success: false,
        message:
          "socials must be a JSON array of { label, href, icon } with valid URLs",
      });
      return;
    }

    if (parsed.length > MAX_SOCIALS) {
      res.status(400).json({
        success: false,
        message: `Maximum ${MAX_SOCIALS} social links allowed`,
      });
      return;
    }

    const doc = await getOrCreateDoc();
    doc.socials = parsed as any;
    await doc.save();

    await publishChange("settings");

    res.status(200).json({
      success: true,
      settings: serializeSettings(doc),
    });
  } catch (err: unknown) {
    res.status(400).json({
      success: false,
      message: err instanceof Error ? err.message : "Failed to update socials",
    });
  }
}
