import { Router } from "express";
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getAllProjects,
} from "../controllers/project.controller";
import { protect } from "../middleware/auth";
import { upload } from "../middleware/uploadMiddleware";

const router = Router();

// Public
router.get("/", getProjects);
router.get("/all", getAllProjects);
router.get("/:id", getProjectById);

// Protected — dashboard only
// router.post("/", createProject);
router.post("/create", upload.single("image"), createProject);
// router.put("/:id", updateProject);
router.put("/:id", upload.single("image"), updateProject);
router.delete("/:id", deleteProject);

export default router;
