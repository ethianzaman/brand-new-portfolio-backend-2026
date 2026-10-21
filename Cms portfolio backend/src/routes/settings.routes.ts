import { Router } from "express";
import {
  getSiteSettings,
  updateBrand,
  updateSocials,
} from "../controllers/settings.controller";
import { upload } from "../middleware/uploadMiddleware";
import { protect } from "../middleware/auth";

const router = Router();

// Public — Navbar and Footer read the shared brand + socials from here
router.get("/", getSiteSettings);

// Brand — name + logo/icon (FormData: optional `logo` file)
router.put("/brand", protect, upload.single("logo"), updateBrand);

// Socials — replace the shared social links list (JSON body)
router.put("/socials", protect, updateSocials);

export default router;
