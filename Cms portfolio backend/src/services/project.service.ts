import type { ParsedQs } from "qs";
import { Project } from "../models/Project";
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
import { firstUnsafeLink, pick } from "../utils/request";
import { serializeDocs } from "../utils/serialize";
import { requireValidSeo, withSeo, withSeoList } from "../utils/seo";
import { uniqueSlug } from "../utils/slug";

const PROJECT_LINKS = ["liveUrl", "githubUrl", "thumbnail"];
const PROJECT_FIELDS = ["title", "description", "category", "tags", "color", "featured", "isPlaceholder", ...PROJECT_LINKS];
const PROJECT_SORT_FIELDS = ["title", "category", "createdAt", "featured"] as const;
const IMAGE_FOLDER = "portfolio/projects";
const PROJECT_NOT_FOUND = "Project not found";

type Body = Record<string, any>;

function assertSafeLinks(body: Body) {
  const unsafe = firstUnsafeLink(body, PROJECT_LINKS);
  if (unsafe) throw badRequest(`${unsafe} must be an http(s) link`);
}

async function announceChange() {
  await publishChange("projects");
  await publishChange("seo");
}

async function runList(filter: Record<string, unknown>, sort: any, pageNum: number, size: number, skip: number) {
  const [projects, total] = await Promise.all([
    Project.find(filter).sort(sort).skip(skip).limit(size).lean().maxTimeMS(MAX_QUERY_TIME_MS),
    Project.countDocuments(filter).maxTimeMS(MAX_QUERY_TIME_MS),
  ]);
  return {
    projects: withSeoList(serializeDocs(projects)),
    ...buildPageMeta(projects, total, pageNum, size),
  };
}

export function listPublic({ category, page = "1", pageSize = "3" }: ParsedQs) {
  const filter: Record<string, unknown> = {};
  if (category && category !== "all") filter.category = category;

  const { pageNum, size, skip } = pageWindow(page, pageSize, 3);
  return runList(filter, { createdAt: -1 }, pageNum, size, skip);
}

export function listForDashboard({ page, pageSize, q, category, sort, dir }: ParsedQs) {
  const filter: Record<string, unknown> = {};
  if (typeof category === "string" && category !== "all") filter.category = category;

  const rx = buildSearchRegex(q);
  if (rx) {
    filter.$or = [{ title: rx }, { description: rx }, { tags: rx }, { category: rx }];
  }

  const { pageNum, size, skip } = pageWindow(page, pageSize, DEFAULT_PAGE_SIZE);
  const sortSpec = resolveSort(sort, dir, PROJECT_SORT_FIELDS, { createdAt: -1 });
  return runList(filter, sortSpec, pageNum, size, skip);
}

export async function getById(id: string) {
  const project = await Project.findById(id);
  if (!project) throw notFound(PROJECT_NOT_FOUND);
  return withSeo(project);
}

/** Legacy projects without a slug are still reachable by id. */
export async function getBySlug(slug: string) {
  const project = await Project.findOne({ slug });
  if (!project) throw notFound(PROJECT_NOT_FOUND);
  return withSeo(project);
}

export async function create(body: Body, file?: Express.Multer.File) {
  assertSafeLinks(body);

  const thumbnail = file ? await uploadImage(file.buffer, IMAGE_FOLDER) : body.thumbnail;

  // An explicit slug wins, otherwise it comes from the title. Always made unique,
  // so duplicate titles never collide on the index.
  const slug = await uniqueSlug(Project, body.slug?.trim() || body.title);
  const seo = requireValidSeo(body.seo);

  const project = await Project.create({ ...pick(body, PROJECT_FIELDS), slug, seo, thumbnail });
  await announceChange();
  return withSeo(project);
}

export async function update(id: string, body: Body, file?: Express.Multer.File) {
  const project = await Project.findById(id);
  if (!project) throw notFound(PROJECT_NOT_FOUND);

  assertSafeLinks(body);

  const changes: Body = pick(body, PROJECT_FIELDS);

  // FormData sends a single tag as a plain string.
  if (body.tags) changes.tags = Array.isArray(body.tags) ? body.tags : [body.tags];
  if (body.featured !== undefined) changes.featured = body.featured === "true";

  // An explicit new slug is honoured. A title-only edit keeps the existing slug,
  // so public links survive. A legacy project with no slug gets one.
  if (body.slug !== undefined && String(body.slug).trim()) {
    changes.slug = await uniqueSlug(Project, body.slug, project._id);
  } else if (!project.slug && body.title) {
    changes.slug = await uniqueSlug(Project, body.title, project._id);
  }

  // Only when sent, so an unrelated edit never wipes stored SEO.
  if (body.seo !== undefined) changes.seo = requireValidSeo(body.seo);

  if (file) changes.thumbnail = await uploadImage(file.buffer, IMAGE_FOLDER);

  const updated = await Project.findByIdAndUpdate(id, changes, { new: true, runValidators: true });

  await removeFileIfUnused(project.thumbnail);
  await removeFileIfUnused(project.seo?.ogImage);
  await announceChange();
  return withSeo(updated);
}

export async function remove(id: string) {
  const project = await Project.findById(id);
  if (!project) throw notFound(PROJECT_NOT_FOUND);

  await project.deleteOne();
  await removeFileIfUnused(project.thumbnail);
  await removeFileIfUnused(project.seo?.ogImage);
  await announceChange();
}

export async function stats() {
  const [row] = await Project.aggregate([
    {
      $facet: {
        byCategory: [{ $group: { _id: "$category", count: { $sum: 1 } } }],
        featured: [{ $match: { featured: true } }, { $count: "count" }],
      },
    },
  ]).option({ maxTimeMS: MAX_QUERY_TIME_MS });

  const byCategory: Record<string, number> = {};
  for (const entry of row?.byCategory ?? []) {
    byCategory[String(entry._id)] = entry.count;
  }

  return {
    total: Object.values(byCategory).reduce((sum, n) => sum + n, 0),
    featured: row?.featured?.[0]?.count ?? 0,
    byCategory,
  };
}
