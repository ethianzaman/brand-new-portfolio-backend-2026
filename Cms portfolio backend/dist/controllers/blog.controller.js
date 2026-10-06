"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlogs = getBlogs;
exports.getBlogById = getBlogById;
exports.getBlogBySlug = getBlogBySlug;
exports.createBlog = createBlog;
exports.updateBlog = updateBlog;
exports.deleteBlog = deleteBlog;
exports.getAllBlogs = getAllBlogs;
const Blog_1 = require("../models/Blog");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}
function calculateReadTime(content) {
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
}
// GET /api/blogs — public, with pagination + filter
async function getBlogs(req, res) {
    try {
        const { category, status = "published", page = "1", pageSize = "6", } = req.query;
        const filter = {};
        if (category && category !== "all") {
            filter.category = category;
        }
        if (status && status !== "all") {
            filter.status = status;
        }
        const pageNum = parseInt(page);
        const size = parseInt(pageSize);
        const skip = (pageNum - 1) * size;
        const [blogs, total] = await Promise.all([
            Blog_1.Blog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size),
            Blog_1.Blog.countDocuments(filter),
        ]);
        res.status(200).json({
            success: true,
            blogs,
            total,
            hasMore: skip + blogs.length < total,
            page: pageNum,
            pageSize: size,
        });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
// GET /api/blogs/:id
async function getBlogById(req, res) {
    try {
        const blog = await Blog_1.Blog.findById(req.params.id);
        if (!blog) {
            res.status(404).json({ success: false, message: "Blog not found" });
            return;
        }
        res.status(200).json({ success: true, blog });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
// GET /api/blogs/slug/:slug
async function getBlogBySlug(req, res) {
    try {
        const blog = await Blog_1.Blog.findOne({ slug: req.params.slug });
        if (!blog) {
            res.status(404).json({ success: false, message: "Blog not found" });
            return;
        }
        res.status(200).json({ success: true, blog });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
// POST /api/blogs/create — protected
async function createBlog(req, res) {
    try {
        let coverImage = req.body.coverImage;
        if (req.file) {
            coverImage = await (0, uploadMiddleware_1.uploadToCloudinary)(req.file.buffer, "portfolio/blogs");
        }
        const title = req.body.title;
        let slug = req.body.slug?.trim() || generateSlug(title);
        const existing = await Blog_1.Blog.findOne({ slug });
        if (existing) {
            slug = `${slug}-${Date.now()}`;
        }
        const content = req.body.content || "";
        const blog = await Blog_1.Blog.create({
            ...req.body,
            slug,
            content,
            coverImage,
            readTime: calculateReadTime(content),
            tags: Array.isArray(req.body.tags)
                ? req.body.tags
                : req.body.tags
                    ? [req.body.tags]
                    : [],
        });
        res.status(201).json({
            success: true,
            blog,
        });
    }
    catch (err) {
        if (err?.code === 11000) {
            res
                .status(400)
                .json({ success: false, message: "A blog with this slug already exists" });
            return;
        }
        res.status(400).json({
            success: false,
            message: err.message,
        });
    }
}
// PUT /api/blogs/:id — protected
async function updateBlog(req, res) {
    try {
        const blog = await Blog_1.Blog.findById(req.params.id);
        if (!blog) {
            res.status(404).json({
                success: false,
                message: "Blog not found",
            });
            return;
        }
        const updateData = {
            ...req.body,
        };
        if (req.body.tags) {
            updateData.tags = Array.isArray(req.body.tags)
                ? req.body.tags
                : [req.body.tags];
        }
        if (req.body.featured !== undefined) {
            updateData.featured = req.body.featured === "true";
        }
        if (req.body.status !== undefined) {
            updateData.status = req.body.status === "draft" ? "draft" : "published";
        }
        const content = req.body.content ?? blog.content;
        updateData.readTime = calculateReadTime(content);
        if (req.file) {
            if (blog.coverImage) {
                await (0, uploadMiddleware_1.deleteFromCloudinary)(blog.coverImage);
            }
            updateData.coverImage = await (0, uploadMiddleware_1.uploadToCloudinary)(req.file.buffer, "portfolio/blogs");
        }
        const updatedBlog = await Blog_1.Blog.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true,
        });
        res.status(200).json({
            success: true,
            blog: updatedBlog,
        });
    }
    catch (err) {
        res.status(400).json({
            success: false,
            message: err.message,
        });
    }
}
// DELETE /api/blogs/:id — protected
async function deleteBlog(req, res) {
    try {
        const blog = await Blog_1.Blog.findById(req.params.id);
        if (!blog) {
            res.status(404).json({
                success: false,
                message: "Blog not found",
            });
            return;
        }
        if (blog.coverImage) {
            await (0, uploadMiddleware_1.deleteFromCloudinary)(blog.coverImage);
        }
        await blog.deleteOne();
        res.status(200).json({
            success: true,
            message: "Blog deleted successfully",
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: err.message || "Server error",
        });
    }
}
// GET /api/blogs/all — protected (dashboard: draft + published)
async function getAllBlogs(req, res) {
    try {
        const blogs = await Blog_1.Blog.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            blogs,
        });
    }
    catch {
        res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
}
