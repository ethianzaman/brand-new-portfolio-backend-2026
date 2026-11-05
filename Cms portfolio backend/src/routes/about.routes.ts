import { publicCache } from "../middleware/publicCache";
import { Router } from "express";
import {
  getAbout,
  updateHero,
  createExperience,
  updateExperience,
  deleteExperience,
  createEducation,
  updateEducation,
  deleteEducation,
  createValue,
  deleteValue,
  updateValue,
} from "../controllers/about.controller";
import { protect, requirePermission } from "../middleware/auth";
import { upload } from "../middleware/uploadMiddleware";

const router = Router();

// Public
router.get("/", publicCache("about"), getAbout);

// Hero — Admin, Manager, Editor
router.put(
  "/hero",
  protect,
  requirePermission("about.edit"),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "resume", maxCount: 1 },
  ]),
  updateHero
);

// Experiences
router.post(
  "/experiences",
  protect,
  requirePermission("about.create"),
  createExperience
);
router.put(
  "/experiences/:id",
  protect,
  requirePermission("about.edit"),
  updateExperience
);
router.delete(
  "/experiences/:id",
  protect,
  requirePermission("about.delete"),
  deleteExperience
);

// Educations
router.post(
  "/educations",
  protect,
  requirePermission("about.create"),
  createEducation
);
router.put(
  "/educations/:id",
  protect,
  requirePermission("about.edit"),
  updateEducation
);
router.delete(
  "/educations/:id",
  protect,
  requirePermission("about.delete"),
  deleteEducation
);

// Values
router.post("/values", protect, requirePermission("about.create"), createValue);
router.put("/values/:id", protect, requirePermission("about.edit"), updateValue);
router.delete("/values/:id", protect, requirePermission("about.delete"), deleteValue);

export default router;
