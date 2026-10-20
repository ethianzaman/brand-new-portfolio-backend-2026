import { Router } from "express";
import {
  getBlogs,
  getBlogById,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog,
  getAllBlogs,
} from "../controllers/blog.controller";
import { protect } from "../middleware/auth";
import { upload } from "../middleware/uploadMiddleware";

const router = Router();

// Public
router.get("/", getBlogs);
router.get("/slug/:slug", getBlogBySlug);

// NOTE: static segments must be registered BEFORE "/:id", otherwise
// "/all" is matched as an id and Blog.findById("all") throws a CastError
// (HTTP 500). Same contract as projects: reads are public, writes protected.
router.get("/all", getAllBlogs);
router.get("/:id", getBlogById);

// Protected — dashboard only
router.post("/create", protect, upload.single("image"), createBlog);
router.put("/:id", protect, upload.single("image"), updateBlog);
router.delete("/:id", protect, deleteBlog);

export default router;
