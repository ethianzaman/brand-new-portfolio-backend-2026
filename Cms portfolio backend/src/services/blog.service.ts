import type { ParsedQs } from "qs";
import { Blog } from "../models/Blog";
import { uploadImage } from "../lib/cloudinary";
import { badRequest, notFound } from "../lib/http";
import { publishChange } from "../lib/publish";
import { removeFileIfUnused } from "./file.service";
import {
  buildPageMeta,
  buildSearchRegex,
  DEFAULT_PAGE_SIZE,
  MAX_QUERY_TIME_MS,
  pageWindow,
  resolveSort,
} from "../utils/query";
import { pick } from "../utils/request";
import { serializeDocs } from "../utils/serialize";
import { requireValidSeo, withSeo, withSeoList } from "../utils/seo";

const BLOG_FIELDS = ["title", "slug", "excerpt", "content", "category", "tags", "coverImage", "featured", "status"];
const BLOG_SORT_FIELDS = ["createdAt", "title", "readTime", "status"] as const;
const IMAGE_FOLDER = "portfolio/blogs";
const BLOG_NOT_FOUND = "Blog not found";

type Body = Record<string, any>;

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

/**
 * Public reads only ever see published posts: drafts are reachable through the
 * protected dashboard list and nowhere else.
 */
export async function listPublic({ category, page = "1", pageSize = "6", q }: ParsedQs) {
  const filter: Record<string, unknown> = { status: "published" };
  if (category && category !== "all") filter.category = category;

  const rx = buildSearchRegex(q);
  if (rx) filter.$or = [{ title: rx }, { excerpt: rx }, { tags: rx }];

  const { pageNum, size, skip } = pageWindow(page, pageSize, 6);

  const [blogs, total] = await Promise.all([
    Blog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(size)
      // The listing never shows the article body, and dropping it is the biggest
      // payload win on the blog page.
      .select("-content")
      .lean()
      .maxTimeMS(MAX_QUERY_TIME_MS),
    Blog.countDocuments(filter).maxTimeMS(MAX_QUERY_TIME_MS),
  ]);

  return {
    blogs: withSeoList(serializeDocs(blogs)),
    ...buildPageMeta(blogs, total, pageNum, size),
  };
}

/** Filtering, search and sorting all run in MongoDB: one page plus a total. */
export async function listForDashboard({ page, pageSize, q, status, category, sort, dir }: ParsedQs) {
  const filter: Record<string, unknown> = {};
  if (typeof status === "string" && status !== "all") filter.status = status;
  if (typeof category === "string" && category !== "all") filter.category = category;

  const rx = buildSearchRegex(q);
  if (rx) {
    filter.$or = [{ title: rx }, { excerpt: rx }, { tags: rx }, { category: rx }];
  }

  const { pageNum, size, skip } = pageWindow(page, pageSize, DEFAULT_PAGE_SIZE);
  const sortSpec = resolveSort(sort, dir, BLOG_SORT_FIELDS, { createdAt: -1 });

  const [blogs, total] = await Promise.all([
    Blog.find(filter).sort(sortSpec).skip(skip).limit(size).lean().maxTimeMS(MAX_QUERY_TIME_MS),
    Blog.countDocuments(filter).maxTimeMS(MAX_QUERY_TIME_MS),
  ]);

  return {
    blogs: withSeoList(serializeDocs(blogs)),
    ...buildPageMeta(blogs, total, pageNum, size),
  };
}

export async function getPublishedById(id: string) {
  const blog = await Blog.findOne({ _id: id, status: "published" });
  if (!blog) throw notFound(BLOG_NOT_FOUND);
  return withSeo(blog);
}

export async function getPublishedBySlug(slug: string) {
  const blog = await Blog.findOne({ slug, status: "published" });
  if (!blog) throw notFound(BLOG_NOT_FOUND);
  return withSeo(blog);
}

export async function create(body: Body, file?: Express.Multer.File) {
  const coverImage = file ? await uploadImage(file.buffer, IMAGE_FOLDER) : body.coverImage;

  let slug = body.slug?.trim() || generateSlug(body.title);
  if (await Blog.findOne({ slug })) slug = `${slug}-${Date.now()}`;

  const content = body.content || "";
  const seo = requireValidSeo(body.seo);

  try {
    const blog = await Blog.create({
      ...pick(body, [...BLOG_FIELDS, "author"]),
      slug,
      content,
      coverImage,
      seo,
      readTime: calculateReadTime(content),
      tags: Array.isArray(body.tags) ? body.tags : body.tags ? [body.tags] : [],
    });
    await publishChange("blogs");
    await publishChange("seo");
    return withSeo(blog);
  } catch (err: any) {
    if (err?.code === 11000) throw badRequest("A blog with this slug already exists");
    throw err;
  }
}

export async function update(id: string, body: Body, file?: Express.Multer.File) {
  const blog = await Blog.findById(id);
  if (!blog) throw notFound(BLOG_NOT_FOUND);

  const changes: Body = pick(body, BLOG_FIELDS);

  if (body.tags) changes.tags = Array.isArray(body.tags) ? body.tags : [body.tags];
  if (body.featured !== undefined) changes.featured = body.featured === "true";
  if (body.status !== undefined) changes.status = body.status === "draft" ? "draft" : "published";

  // Only when sent, so an unrelated edit never wipes stored SEO.
  if (body.seo !== undefined) changes.seo = requireValidSeo(body.seo);

  changes.readTime = calculateReadTime(body.content ?? blog.content);

  if (file) changes.coverImage = await uploadImage(file.buffer, IMAGE_FOLDER);

  const updated = await Blog.findByIdAndUpdate(id, changes, { new: true, runValidators: true });
  await removeFileIfUnused(blog.coverImage);
  await removeFileIfUnused(blog.seo?.ogImage);
  await publishChange("blogs");
  await publishChange("seo");
  return withSeo(updated);
}

export async function remove(id: string) {
  const blog = await Blog.findById(id);
  if (!blog) throw notFound(BLOG_NOT_FOUND);

  await blog.deleteOne();
  await removeFileIfUnused(blog.coverImage);
  await removeFileIfUnused(blog.seo?.ogImage);
  await publishChange("blogs");
}

/** One pass over the collection, instead of counting in the browser. */
export async function stats() {
  const [result] = await Blog.aggregate([
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              published: { $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] } },
              featured: { $sum: { $cond: [{ $eq: ["$featured", true] }, 1, 0] } },
              readTime: { $sum: { $ifNull: ["$readTime", 0] } },
            },
          },
        ],
        byCategory: [{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }],
      },
    },
  ]).option({ maxTimeMS: MAX_QUERY_TIME_MS });

  const row = result?.totals?.[0];

  const byCategory: Record<string, number> = {};
  for (const entry of result?.byCategory ?? []) {
    if (!entry?._id) continue;
    byCategory[entry._id] = entry.count;
  }

  return {
    total: row?.total ?? 0,
    published: row?.published ?? 0,
    featured: row?.featured ?? 0,
    readTime: row?.readTime ?? 0,
    byCategory,
  };
}
