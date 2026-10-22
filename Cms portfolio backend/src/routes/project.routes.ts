import { Router } from "express";
import {
  getProjects,
  getProjectById,
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
router.get("/", getProjects);

// NOTE: static segments must be registered BEFORE "/:id", otherwise
// "/all" is matched as an id and Project.findById("all") throws a CastError
// (HTTP 500).
router.get("/all", getAllProjects);
router.get("/stats", getProjectStats);
router.get("/:id", getProjectById);

// Protected — dashboard only
// Create/update: Admin, Manager, Editor.  Delete: Admin, Manager.
router.post(
  "/create",
  protect,
  requirePermission("create"),
  upload.single("image"),
  createProject
);
router.put(
  "/:id",
  protect,
  requirePermission("update"),
  upload.single("image"),
  updateProject
);
router.delete("/:id", protect, requirePermission("delete"), deleteProject);

export default router;
