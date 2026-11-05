import { handle, WRITE_FAILURE } from "../lib/http";
import * as blogs from "../services/blog.service";

export const getBlogs = handle(async (req, res) => {
  res.status(200).json({ success: true, ...(await blogs.listPublic(req.query)) });
});

export const getAllBlogs = handle(async (req, res) => {
  res.status(200).json({ success: true, ...(await blogs.listForDashboard(req.query)) });
});

export const getBlogStats = handle(async (_req, res) => {
  res.status(200).json({ success: true, stats: await blogs.stats() });
});

export const getBlogById = handle(async (req, res) => {
  res.status(200).json({ success: true, blog: await blogs.getPublishedById(req.params.id) });
});

export const getBlogBySlug = handle(async (req, res) => {
  res.status(200).json({ success: true, blog: await blogs.getPublishedBySlug(req.params.slug) });
});

export const createBlog = handle(async (req, res) => {
  const blog = await blogs.create(req.body, req.file);
  res.status(201).json({ success: true, blog });
}, WRITE_FAILURE);

export const updateBlog = handle(async (req, res) => {
  const blog = await blogs.update(req.params.id, req.body, req.file);
  res.status(200).json({ success: true, blog });
}, WRITE_FAILURE);

export const deleteBlog = handle(
  async (req, res) => {
    await blogs.remove(req.params.id);
    res.status(200).json({ success: true, message: "Blog deleted successfully" });
  },
  { status: 500, message: "Server error" },
);
