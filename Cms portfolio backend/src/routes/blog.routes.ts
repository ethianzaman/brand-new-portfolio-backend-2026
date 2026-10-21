import { Router } from "express";
import {
  getBlogs,
  getBlogById,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog,
  getAllBlogs,
  getBlogStats,
} from "../controllers/blog.controller";
import { protect, requirePermission } from "../middleware/auth";
import { upload } from "../middleware/uploadMiddleware";

const router = Router();

// Public
router.get("/", getBlogs);
router.get("/slug/:slug", getBlogBySlug);

// NOTE: static segments must be registered BEFORE "/:id", otherwise
// "/all" is matched as an id and Blog.findById("all") throws a CastError
// (HTTP 500). Same contract as projects: reads are public, writes protected.
router.get("/all", getAllBlogs);
router.get("/stats", getBlogStats);
router.get("/:id", getBlogById);

// Protected — dashboard only
// Create/update: Admin, Manager, Editor.  Delete: Admin, Manager.
router.post(
  "/create",
  protect,
  requirePermission("create"),
  upload.single("image"),
  createBlog
);
router.put(
  "/:id",
  protect,
  requirePermission("update"),
  upload.single("image"),
  updateBlog
);
router.delete("/:id", protect, requirePermission("delete"), deleteBlog);

export default router;
