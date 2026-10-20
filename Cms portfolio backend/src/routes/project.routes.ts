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

// NOTE: static segments must be registered BEFORE "/:id", otherwise
// "/all" is matched as an id and Project.findById("all") throws a CastError
// (HTTP 500).
router.get("/all", getAllProjects);
router.get("/:id", getProjectById);

// Protected — dashboard only
// router.post("/", createProject);
router.post("/create", protect, upload.single("image"), createProject);
// router.put("/:id", updateProject);
router.put("/:id", protect, upload.single("image"), updateProject);
router.delete("/:id", protect, deleteProject);

export default router;
