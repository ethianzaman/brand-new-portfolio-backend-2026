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
import { protect } from "../middleware/auth";
import { upload } from "../middleware/uploadMiddleware";

const router = Router();

// Public
router.get("/", getSkills);

// Category CRUD — protected
router.post("/categories", createCategory);
router.put("/categories/:id", updateCategory);
router.delete("/categories/:id", deleteCategory);

// Skill CRUD inside category — protected
// router.post("/categories/:id/skills", addSkill);
router.post("/categories/:id/skills", upload.single("icon"), addSkill);
router.put("/categories/:id/skills/:skillName", upload.single("icon"), updateSkill);
router.delete("/categories/:id/skills/:skillName", deleteSkill);

export default router;
