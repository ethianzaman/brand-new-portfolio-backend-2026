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
  getPageSeo,
  updatePageSeo,
} from "../controllers/settings.controller";
import { socialLogoUpload, upload } from "../middleware/uploadMiddleware";
import { protect, requirePermission } from "../middleware/auth";

const router = Router();

// Public — Navbar and Footer read the shared brand + socials from here
router.get("/", getSiteSettings);

// Public — static-page SEO overrides for the public resolver.
router.get("/pages/seo", getPageSeo);

// Brand settings are site content (not security-sensitive): Admin, Manager, Editor.
router.put(
  "/brand",
  protect,
  requirePermission("update"),
  upload.single("logo"),
  updateBrand
);

// Merges the old per-section lists into the library. Safe to call twice.
router.post(
  "/socials/setup",
  protect,
  requirePermission("update"),
  setupSocialLibrary
);

// Social link library — FormData, so a link can carry an uploaded logo.
router.post(
  "/socials",
  protect,
  requirePermission("create"),
  socialLogoUpload,
  createSocial
);
router.put(
  "/socials/:id",
  protect,
  requirePermission("update"),
  socialLogoUpload,
  updateSocial
);
router.delete(
  "/socials/:id",
  protect,
  requirePermission("delete"),
  deleteSocial
);

// Which links each section shows, and in what order (JSON body).
router.put(
  "/social-placements",
  protect,
  requirePermission("update"),
  updateSocialPlacements
);

// Global SEO defaults — Admin, Manager, Editor (site content).
router.put("/seo", protect, requirePermission("update"), updateSeo);

// Static-page SEO overrides — Admin, Manager, Editor.
router.put(
  "/pages/seo/:page",
  protect,
  requirePermission("update"),
  updatePageSeo
);

export default router;
