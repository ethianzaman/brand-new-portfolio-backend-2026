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
  // updateValue,
  deleteValue,
  updateValue,
} from "../controllers/about.controller";
import { protect } from "../middleware/auth";
import { upload } from "../middleware/uploadMiddleware";

const router = Router();

// Public
router.get("/", getAbout);

// Hero — protected
// router.put('/hero', protect, updateHero)
router.put("/hero",protect, upload.single("image"), updateHero);

// Experiences — protected
router.post("/experiences",protect, createExperience);
router.put("/experiences/:id", protect, updateExperience);
router.delete("/experiences/:id", protect, deleteExperience);

// Educations — protected
router.post("/educations", protect, createEducation);
router.put("/educations/:id", protect, updateEducation);
router.delete("/educations/:id", protect, deleteEducation);

// Values — protected
router.post("/values", protect, createValue);
router.put("/values/:id", protect, updateValue);
router.delete("/values/:id", protect, deleteValue);

export default router;
