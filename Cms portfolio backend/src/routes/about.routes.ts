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
router.put("/hero", upload.single("image"), updateHero);

// Experiences — protected
router.post("/experiences", createExperience);
router.put("/experiences/:id", updateExperience);
router.delete("/experiences/:id", deleteExperience);

// Educations — protected
router.post("/educations", createEducation);
router.put("/educations/:id", updateEducation);
router.delete("/educations/:id", deleteEducation);

// Values — protected
router.post("/values", createValue);
router.put("/values/:id", updateValue);
router.delete("/values/:id", deleteValue);

export default router;
