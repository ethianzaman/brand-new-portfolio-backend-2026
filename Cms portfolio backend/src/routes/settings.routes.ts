import { publicCache } from "../middleware/publicCache";
import { Router } from "express";
import {
  getSiteSettings,
  updateBrand,
  setupSocialLibrary,
  createSocial,
  updateSocial,
  deleteSocial,
  updateSocialPlacements,
  updateSeo,
  uploadOgImage,
  discardOgImage,
  getPageSeo,
  updatePageSeo,
} from "../controllers/settings.controller";
import { ogImageUpload, socialLogoUpload, upload } from "../middleware/uploadMiddleware";
import { protect, requireAnyPermission, requirePermission } from "../middleware/auth";

const router = Router();

// Everyone who can edit a page, post, project or service.
const OG_IMAGE_EDITORS = requireAnyPermission([
  "seo.edit",
  "blog.create",
  "blog.edit",
  "projects.create",
  "projects.edit",
  "services.create",
  "services.edit",
]);

// Public — Navbar and Footer read the shared brand + socials from here
router.get("/", publicCache("settings"), getSiteSettings);

// Public — static-page SEO overrides for the public resolver.
router.get("/pages/seo", publicCache("seo"), getPageSeo);

// Share images, for everyone who can edit a page, post, project or service.
router.post(
  "/og-image",
  protect,
  OG_IMAGE_EDITORS,
  ogImageUpload,
  uploadOgImage,
);
router.delete("/og-image", protect, OG_IMAGE_EDITORS, discardOgImage);

// Brand settings are site content (not security-sensitive): Admin, Manager, Editor.
router.put(
  "/brand",
  protect,
  requirePermission("settings.edit"),
  upload.single("logo"),
  updateBrand
);

// Merges the old per-section lists into the library. Safe to call twice.
router.post(
  "/socials/setup",
  protect,
  requirePermission("socialLinks.edit"),
  setupSocialLibrary
);

// Social link library — FormData, so a link can carry an uploaded logo.
router.post(
  "/socials",
  protect,
  requirePermission("socialLinks.create"),
  socialLogoUpload,
  createSocial
);
router.put(
  "/socials/:id",
  protect,
  requirePermission("socialLinks.edit"),
  socialLogoUpload,
  updateSocial
);
router.delete(
  "/socials/:id",
  protect,
  requirePermission("socialLinks.delete"),
  deleteSocial
);

// Which links each section shows, and in what order (JSON body).
router.put(
  "/social-placements",
  protect,
  requirePermission("socialLinks.edit"),
  updateSocialPlacements
);

// Global SEO defaults — Admin, Manager, Editor (site content).
router.put("/seo", protect, requirePermission("seo.edit"), updateSeo);

// Static-page SEO overrides — Admin, Manager, Editor.
router.put(
  "/pages/seo/:page",
  protect,
  requirePermission("seo.edit"),
  updatePageSeo
);

export default router;
