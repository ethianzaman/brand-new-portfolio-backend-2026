import type { ParsedQs } from "qs";
import { Project, PROJECT_STATUSES } from "../models/Project";
import { uploadImage } from "../lib/cloudinary";
import { badRequest, notFound } from "../lib/http";
import { publishChange } from "../lib/publish";
import {
  planImageList,
  readList,
  removeFilesIfUnused,
  resolveImageList,
  type ImageListPlan,
} from "./media.service";
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
const GALLERY_FOLDER = "portfolio/projects/gallery";
const PROJECT_NOT_FOUND = "Project not found";

type Body = Record<string, any>;

export interface ProjectFiles {
  image?: Express.Multer.File[];
  cardImages?: Express.Multer.File[];
  gallery?: Express.Multer.File[];
}

/** The thumbnail plus three more. */
const MAX_CARD_IMAGES = 4;
const MAX_GALLERY = 8;
const MAX_FEATURES = 20;
const FEATURE_MAX = 200;
/** Case study text fields and their length limits. */
const CASE_STUDY_TEXT: Record<string, number> = {
  goal: 5000,
  approach: 5000,
  challenges: 5000,
  outcome: 5000,
  role: 80,
  year: 20,
};

/** The case study fields the request sent, cleaned. Fields it left out stay as they are. */
function readCaseStudy(body: Body): Body {
  const changes: Body = {};

  for (const [field, max] of Object.entries(CASE_STUDY_TEXT)) {
    if (body[field] === undefined) continue;
    const text = String(body[field]).trim();
    if (text.length > max) throw badRequest(`${field} can be up to ${max} characters`);
    changes[field] = text;
  }

  if (body.status !== undefined) {
    if (!(PROJECT_STATUSES as readonly string[]).includes(body.status)) {
      throw badRequest("status must be live, in-progress or archived");
    }
    changes.status = body.status;
  }

  if (body.features !== undefined) {
    const features = readList(body.features).map((item) => item.trim()).filter(Boolean);
    if (features.length > MAX_FEATURES) throw badRequest(`Up to ${MAX_FEATURES} features`);
    if (features.some((item) => item.length > FEATURE_MAX)) {
      throw badRequest(`Each feature can be up to ${FEATURE_MAX} characters`);
    }
    changes.features = features;
  }

  return changes;
}

/** Every file a project points at, for clean-up. */
function filesOf(project: {
  thumbnail?: string;
  images?: string[];
  gallery?: string[];
  seo?: { ogImage?: string };
}) {
  return [project.thumbnail, ...(project.images ?? []), ...(project.gallery ?? []), project.seo?.ogImage];
}

/** Both image lists, checked before anything is uploaded. */
function planMedia(body: Body, files: ProjectFiles | undefined, current: { thumbnail?: string; images?: string[]; gallery?: string[] }) {
  return {
    cardImages: planImageList(
      body.cardImages,
      files?.cardImages,
      [current.thumbnail, ...(current.images ?? [])].filter((url): url is string => Boolean(url)),
      { max: MAX_CARD_IMAGES, folder: IMAGE_FOLDER, label: "Card images" },
    ),
    gallery: planImageList(body.gallery, files?.gallery, current.gallery ?? [], {
      max: MAX_GALLERY,
      folder: GALLERY_FOLDER,
      label: "Screenshots",
    }),
  };
}

/** Uploads what the plans need and returns the fields to save. */
async function resolveMedia(
  plans: { cardImages?: ImageListPlan; gallery?: ImageListPlan },
  uploaded: string[],
) {
  const [cardImages, gallery] = await Promise.all([
    plans.cardImages && resolveImageList(plans.cardImages, uploaded),
    plans.gallery && resolveImageList(plans.gallery, uploaded),
  ]);
  return {
    ...(cardImages && { thumbnail: cardImages[0] ?? "", images: cardImages.slice(1) }),
    ...(gallery && { gallery }),
  };
}

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

export async function create(body: Body, files?: ProjectFiles) {
  assertSafeLinks(body);
  const file = files?.image?.[0];
  const caseStudy = readCaseStudy(body);
  const seo = requireValidSeo(body.seo);
  const plans = planMedia(body, files, { thumbnail: body.thumbnail });

  // Uploads made for a project that then fails to save are removed again.
  const uploaded: string[] = [];
  try {
    const thumbnail = file ? await uploadImage(file.buffer, IMAGE_FOLDER) : body.thumbnail;
    if (file) uploaded.push(thumbnail);
    const media = await resolveMedia(plans, uploaded);

    // An explicit slug wins, otherwise it comes from the title. Always made
    // unique, so duplicate titles never collide on the index.
    const slug = await uniqueSlug(Project, body.slug?.trim() || body.title);

    const project = await Project.create({
      ...pick(body, PROJECT_FIELDS),
      ...caseStudy,
      thumbnail,
      ...media,
      slug,
      seo,
    });
    await announceChange();
    return withSeo(project);
  } catch (err) {
    await removeFilesIfUnused(uploaded);
    throw err;
  }
}

export async function update(id: string, body: Body, files?: ProjectFiles) {
  const project = await Project.findById(id);
  if (!project) throw notFound(PROJECT_NOT_FOUND);

  assertSafeLinks(body);
  const file = files?.image?.[0];

  const changes: Body = { ...pick(body, PROJECT_FIELDS), ...readCaseStudy(body) };
  const plans = planMedia(body, files, project);

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

  const uploaded: string[] = [];
  let updated;
  try {
    if (file) {
      changes.thumbnail = await uploadImage(file.buffer, IMAGE_FOLDER);
      uploaded.push(changes.thumbnail);
    }
    Object.assign(changes, await resolveMedia(plans, uploaded));
    updated = await Project.findByIdAndUpdate(id, changes, { new: true, runValidators: true });
  } catch (err) {
    await removeFilesIfUnused(uploaded);
    throw err;
  }

  // Replaced or removed files go; anything the saved project, or any other
  // section, still uses is kept.
  await removeFilesIfUnused(filesOf(project));
  await announceChange();
  return withSeo(updated);
}

export async function remove(id: string) {
  const project = await Project.findById(id);
  if (!project) throw notFound(PROJECT_NOT_FOUND);

  await project.deleteOne();
  await removeFilesIfUnused(filesOf(project));
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
