import { publicCache } from "../middleware/publicCache";
import { Router } from "express";
import {
  getProjects,
  getProjectById,
  getProjectBySlug,
  createProject,
  updateProject,
  deleteProject,
  getAllProjects,
  getProjectStats,
} from "../controllers/project.controller";
import { protect, requirePermission } from "../middleware/auth";
import { upload } from "../middleware/uploadMiddleware";

const router = Router();

// Public
router.get("/", publicCache("projects"), getProjects);

// NOTE: static segments must be registered BEFORE "/:id", otherwise
// "/all" is matched as an id and Project.findById("all") throws a CastError
// (HTTP 500).
router.get("/all", protect, requirePermission("projects.view"), getAllProjects);
router.get("/stats", protect, requirePermission("projects.view"), getProjectStats);
router.get("/slug/:slug", publicCache("projects"), getProjectBySlug);
router.get("/:id", protect, requirePermission("projects.view"), getProjectById);

// Protected — dashboard only
// Create/update: Admin, Manager, Editor.  Delete: Admin, Manager.
router.post(
  "/create",
  protect,
  requirePermission("projects.create"),
  upload.single("image"),
  createProject
);
router.put(
  "/:id",
  protect,
  requirePermission("projects.edit"),
  upload.single("image"),
  updateProject
);
router.delete("/:id", protect, requirePermission("projects.delete"), deleteProject);

export default router;
