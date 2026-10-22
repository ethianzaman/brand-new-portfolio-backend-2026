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
router.get("/", getAbout);

// Hero — Admin, Manager, Editor
router.put(
  "/hero",
  protect,
  requirePermission("update"),
  upload.single("image"),
  updateHero
);

// Experiences
router.post(
  "/experiences",
  protect,
  requirePermission("create"),
  createExperience
);
router.put(
  "/experiences/:id",
  protect,
  requirePermission("update"),
  updateExperience
);
router.delete(
  "/experiences/:id",
  protect,
  requirePermission("delete"),
  deleteExperience
);

// Educations
router.post(
  "/educations",
  protect,
  requirePermission("create"),
  createEducation
);
router.put(
  "/educations/:id",
  protect,
  requirePermission("update"),
  updateEducation
);
router.delete(
  "/educations/:id",
  protect,
  requirePermission("delete"),
  deleteEducation
);

// Values
router.post("/values", protect, requirePermission("create"), createValue);
router.put("/values/:id", protect, requirePermission("update"), updateValue);
router.delete("/values/:id", protect, requirePermission("delete"), deleteValue);

export default router;
