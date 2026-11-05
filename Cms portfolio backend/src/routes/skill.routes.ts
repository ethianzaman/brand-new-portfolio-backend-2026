import { publicCache } from "../middleware/publicCache";
import { Router } from "express";
import {
  getSkills,
  createCategory,
  updateCategory,
  deleteCategory,
  addSkill,
  updateSkill,
  deleteSkill,
} from "../controllers/skill.controller";
import { protect, requirePermission } from "../middleware/auth";
import { upload } from "../middleware/uploadMiddleware";

const router = Router();

// Public
router.get("/", publicCache("skills"), getSkills);

// Category CRUD — create/update: Admin, Manager, Editor.  Delete: Admin, Manager.
router.post("/categories", protect, requirePermission("skills.create"), createCategory);
router.put(
  "/categories/:id",
  protect,
  requirePermission("skills.edit"),
  updateCategory
);
router.delete(
  "/categories/:id",
  protect,
  requirePermission("skills.delete"),
  deleteCategory
);

// Skill CRUD inside category — same permission policy as categories
router.post(
  "/categories/:id/skills",
  protect,
  requirePermission("skills.create"),
  upload.single("icon"),
  addSkill
);
router.put(
  "/categories/:id/skills/:skillName",
  protect,
  requirePermission("skills.edit"),
  upload.single("icon"),
  updateSkill
);
router.delete(
  "/categories/:id/skills/:skillName",
  protect,
  requirePermission("skills.delete"),
  deleteSkill
);

export default router;
