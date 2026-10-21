import { Router } from "express";
import {
  getSiteSettings,
  updateBrand,
  updateSocials,
} from "../controllers/settings.controller";
import { upload } from "../middleware/uploadMiddleware";
import { protect, requirePermission } from "../middleware/auth";

const router = Router();

// Public — Navbar and Footer read the shared brand + socials from here
router.get("/", getSiteSettings);

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

export default router;
