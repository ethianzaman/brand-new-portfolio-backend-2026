"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSiteSettings = getSiteSettings;
exports.updateBrand = updateBrand;
const SiteSettings_1 = require("../models/SiteSettings");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const publish_1 = require("../lib/publish");
const TITLE_MAX = 120;
const TAGLINE_MAX = 160;
const ICON_MAX = 40;
const URL_MAX = 500;
const LOGO_TYPES = ["icon", "image"];
/** Map the Mongoose document to the public `settings` envelope shape. */
function serializeSettings(doc) {
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
    };
}
/**
 * Singleton accessor — same get-or-create idea as the Contact/Home controllers.
 * Defaults seed the currently shipped brand so the public site keeps rendering
 * exactly as before until an admin changes it.
 */
async function getOrCreateDoc() {
    let doc = await SiteSettings_1.SiteSettings.findOne();
    if (!doc) {
        doc = await SiteSettings_1.SiteSettings.create({
            brand: {
                name: "Ethian",
                tagline: "Full Stack Engineer",
                logo: { type: "icon", icon: "zap", url: "" },
            },
        });
    }
    return doc;
}
// ── GET /api/settings — public ─────────────────────────────────────────────────
async function getSiteSettings(_req, res) {
    try {
        const doc = await getOrCreateDoc();
        res.status(200).json({
            success: true,
            settings: serializeSettings(doc),
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: err instanceof Error ? err.message : "Server error",
        });
    }
}
// ── PUT /api/settings/brand — update brand name + logo (FormData) ──────────────
async function updateBrand(req, res) {
    try {
        const { name, tagline, logoType, logoIcon, logoUrl } = req.body ?? {};
        const file = req.file;
        const doc = await getOrCreateDoc();
        const oldLogoUrl = doc.brand?.logo?.url ?? "";
        const updateFields = {};
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
        let nextType;
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
            const uploadedUrl = await (0, uploadMiddleware_1.uploadToCloudinary)(file.buffer, "portfolio_brand");
            updateFields["brand.logo.url"] = uploadedUrl;
            updateFields["brand.logo.type"] = "image";
            nextType = "image";
        }
        else if (logoUrl !== undefined) {
            updateFields["brand.logo.url"] = String(logoUrl).trim().slice(0, URL_MAX);
        }
        // An "image" logo must actually resolve to a URL once we are done.
        const effectiveType = nextType ?? doc.brand?.logo?.type ?? "icon";
        const effectiveUrl = updateFields["brand.logo.url"] ??
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
        const updated = await SiteSettings_1.SiteSettings.findByIdAndUpdate(doc._id, { $set: updateFields }, { new: true, runValidators: true });
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
            await (0, uploadMiddleware_1.deleteFromCloudinary)(oldLogoUrl);
        }
        await (0, publish_1.publishChange)("settings");
        res.status(200).json({
            success: true,
            settings: serializeSettings(updated),
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: err instanceof Error ? err.message : "Server error",
        });
    }
}
