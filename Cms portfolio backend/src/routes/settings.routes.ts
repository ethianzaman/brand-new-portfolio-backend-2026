import { Router } from "express";
import {
  getSiteSettings,
  updateBrand,
  updateSocials,
  updateSeo,
  getPageSeo,
  updatePageSeo,
} from "../controllers/settings.controller";
import { upload } from "../middleware/uploadMiddleware";
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

// Socials — replace the shared social links list (JSON body)
router.put("/socials", protect, requirePermission("update"), updateSocials);

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
