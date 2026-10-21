import { Request, Response } from "express";
import { Blog } from "../models/Blog";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../middleware/uploadMiddleware";
import { publishChange } from "../lib/publish";
import {
  buildPageMeta,
  buildSearchRegex,
  clampInt,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_QUERY_TIME_MS,
  resolveSort,
} from "../utils/query";
import { serializeDocs } from "../utils/serialize";

/** Fields the dashboard list is allowed to sort by. */
const BLOG_SORT_FIELDS = ["createdAt", "title", "readTime", "status"] as const;

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function calculateReadTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

// GET /api/blogs — public, with pagination + filter
export async function getBlogs(req: Request, res: Response): Promise<void> {
  try {
    const {
      category,
      status = "published",
      page = "1",
      pageSize = "6",
      q,
    } = req.query;

    const filter: Record<string, unknown> = {};
    if (category && category !== "all") {
      filter.category = category;
    }
    if (status && status !== "all") {
      filter.status = status;
    }

    const rx = buildSearchRegex(q);
    if (rx) {
      filter.$or = [{ title: rx }, { excerpt: rx }, { tags: rx }];
    }

    const pageNum = clampInt(page, 1, 1, 10_000);
    const size = clampInt(pageSize, 6, 1, MAX_PAGE_SIZE);
    const skip = (pageNum - 1) * size;

    const [blogs, total] = await Promise.all([
      Blog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(size)
        // The public listing never renders the article body — the detail page
        // fetches it on its own. Dropping it here is the single biggest
        // payload win on the blog page.
        .select("-content")
        .lean()
        .maxTimeMS(MAX_QUERY_TIME_MS),
      Blog.countDocuments(filter).maxTimeMS(MAX_QUERY_TIME_MS),
    ]);

    res.status(200).json({
      success: true,
      blogs: serializeDocs(blogs),
      ...buildPageMeta(blogs, total, pageNum, size),
    });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// GET /api/blogs/:id
export async function getBlogById(req: Request, res: Response): Promise<void> {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      res.status(404).json({ success: false, message: "Blog not found" });
      return;
    }
    res.status(200).json({ success: true, blog });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// GET /api/blogs/slug/:slug
export async function getBlogBySlug(req: Request, res: Response): Promise<void> {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug });
    if (!blog) {
      res.status(404).json({ success: false, message: "Blog not found" });
      return;
    }
    res.status(200).json({ success: true, blog });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// POST /api/blogs/create — protected
export async function createBlog(req: Request, res: Response): Promise<void> {
  try {
    let coverImage = req.body.coverImage;

    if (req.file) {
      coverImage = await uploadToCloudinary(req.file.buffer, "portfolio/blogs");
    }

    const title = req.body.title;
    let slug = req.body.slug?.trim() || generateSlug(title);

    const existing = await Blog.findOne({ slug });
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    const content = req.body.content || "";

    const blog = await Blog.create({
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
    await publishChange("blogs");
    res.status(201).json({
      success: true,
      blog,
    });
  } catch (err: any) {
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
export async function updateBlog(req: Request, res: Response): Promise<void> {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      res.status(404).json({
        success: false,
        message: "Blog not found",
      });
      return;
    }

    const updateData: any = {
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
        await deleteFromCloudinary(blog.coverImage);
      }

      updateData.coverImage = await uploadToCloudinary(
        req.file.buffer,
        "portfolio/blogs",
      );
    }

    const updatedBlog = await Blog.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });
    await publishChange("blogs");
    res.status(200).json({
      success: true,
      blog: updatedBlog,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
}

// DELETE /api/blogs/:id — protected
export async function deleteBlog(req: Request, res: Response): Promise<void> {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      res.status(404).json({
        success: false,
        message: "Blog not found",
      });
      return;
    }

    if (blog.coverImage) {
      await deleteFromCloudinary(blog.coverImage);
    }

    await blog.deleteOne();

    await publishChange("blogs");
    res.status(200).json({
      success: true,
      message: "Blog deleted successfully",
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
}

// GET /api/blogs/all — dashboard list (drafts + published), paginated + searchable
//
// Query: ?page=1&pageSize=10&q=react&status=all&category=all&sort=createdAt&dir=desc
//
// The filtering, searching and sorting all happen in MongoDB — the dashboard
// receives one page of rows plus the total count, never the whole collection.
export async function getAllBlogs(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { page, pageSize, q, status, category, sort, dir } = req.query;

    const pageNum = clampInt(page, 1, 1, 10_000);
    const size = clampInt(pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const skip = (pageNum - 1) * size;

    const filter: Record<string, unknown> = {};
    if (typeof status === "string" && status !== "all") {
      filter.status = status;
    }
    if (typeof category === "string" && category !== "all") {
      filter.category = category;
    }

    const rx = buildSearchRegex(q);
    if (rx) {
      filter.$or = [
        { title: rx },
        { excerpt: rx },
        { tags: rx },
        { category: rx },
      ];
    }

    const sortSpec = resolveSort(sort, dir, BLOG_SORT_FIELDS, { createdAt: -1 });

    const [blogs, total] = await Promise.all([
      Blog.find(filter)
        .sort(sortSpec)
        .skip(skip)
        .limit(size)
        .lean()
        .maxTimeMS(MAX_QUERY_TIME_MS),
      Blog.countDocuments(filter).maxTimeMS(MAX_QUERY_TIME_MS),
    ]);

    res.status(200).json({
      success: true,
      blogs: serializeDocs(blogs),
      ...buildPageMeta(blogs, total, pageNum, size),
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

// GET /api/blogs/stats — dashboard stat cards
//
// One aggregation pass over the collection instead of pulling every document
// into the browser and counting there. Kept on its own endpoint so the numbers
// are cached independently of the page the user is looking at.
export async function getBlogStats(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    // `$facet` runs both facets against a single scan of the collection.
    const [result] = await Blog.aggregate([
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                published: {
                  $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
                },
                featured: {
                  $sum: { $cond: [{ $eq: ["$featured", true] }, 1, 0] },
                },
                readTime: { $sum: { $ifNull: ["$readTime", 0] } },
              },
            },
          ],
          byCategory: [
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
        },
      },
    ]).option({ maxTimeMS: MAX_QUERY_TIME_MS });

    const row = result?.totals?.[0];

    const byCategory: Record<string, number> = {};
    for (const entry of result?.byCategory ?? []) {
      if (!entry?._id) continue;
      byCategory[entry._id] = entry.count;
    }

    res.status(200).json({
      success: true,
      stats: {
        total: row?.total ?? 0,
        published: row?.published ?? 0,
        featured: row?.featured ?? 0,
        readTime: row?.readTime ?? 0,
        byCategory,
      },
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}
