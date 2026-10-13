"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const blog_controller_1 = require("../controllers/blog.controller");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const router = (0, express_1.Router)();
// Public
router.get("/", blog_controller_1.getBlogs);
router.get("/all", blog_controller_1.getAllBlogs);
router.get("/slug/:slug", blog_controller_1.getBlogBySlug);
router.get("/:id", blog_controller_1.getBlogById);
// Protected — dashboard only
router.post("/create", uploadMiddleware_1.upload.single("image"), blog_controller_1.createBlog);
router.put("/:id", uploadMiddleware_1.upload.single("image"), blog_controller_1.updateBlog);
router.delete("/:id", blog_controller_1.deleteBlog);
exports.default = router;
