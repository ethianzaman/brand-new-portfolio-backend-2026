"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const blog_controller_1 = require("../controllers/blog.controller");
const auth_1 = require("../middleware/auth");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const router = (0, express_1.Router)();
// Public
router.get("/", blog_controller_1.getBlogs);
router.get("/slug/:slug", blog_controller_1.getBlogBySlug);
// NOTE: static segments must be registered BEFORE "/:id", otherwise
// "/all" is matched as an id and Blog.findById("all") throws a CastError
// (HTTP 500). Same contract as projects: reads are public, writes protected.
router.get("/all", blog_controller_1.getAllBlogs);
router.get("/stats", blog_controller_1.getBlogStats);
router.get("/:id", blog_controller_1.getBlogById);
// Protected — dashboard only
// Create/update: Admin, Manager, Editor.  Delete: Admin, Manager.
router.post("/create", auth_1.protect, (0, auth_1.requirePermission)("create"), uploadMiddleware_1.upload.single("image"), blog_controller_1.createBlog);
router.put("/:id", auth_1.protect, (0, auth_1.requirePermission)("update"), uploadMiddleware_1.upload.single("image"), blog_controller_1.updateBlog);
router.delete("/:id", auth_1.protect, (0, auth_1.requirePermission)("delete"), blog_controller_1.deleteBlog);
exports.default = router;
