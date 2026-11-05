import type { ParsedQs } from "qs";
import { Service } from "../models/Service";
import { notFound } from "../lib/http";
import { publishChange } from "../lib/publish";
import { removeFileIfUnused } from "./file.service";
import {
  buildPageMeta,
  buildSearchRegex,
  MAX_PAGE_SIZE,
  MAX_QUERY_TIME_MS,
  pageWindow,
} from "../utils/query";
import { pick } from "../utils/request";
import { serializeDocs } from "../utils/serialize";
import { requireValidSeo, withSeo, withSeoList } from "../utils/seo";
import { uniqueSlug } from "../utils/slug";

const SERVICE_FIELDS = ["icon", "title", "description", "features", "tags", "color", "popular"];
const SERVICE_NOT_FOUND = "Service not found";

type Body = Record<string, any>;

async function announceChange() {
  await publishChange("services");
  await publishChange("seo");
}

/**
 * Public and dashboard list. The public grid shows every service, so with no
 * page size this answers with the full set, bounded at MAX_PAGE_SIZE.
 */
export async function list({ page, pageSize, q }: ParsedQs) {
  const filter: Record<string, unknown> = {};

  const rx = buildSearchRegex(q);
  if (rx) {
    filter.$or = [{ title: rx }, { description: rx }, { tags: rx }, { "features.text": rx }];
  }

  const { pageNum, size, skip } = pageWindow(page, pageSize, MAX_PAGE_SIZE);

  const [services, total] = await Promise.all([
    Service.find(filter).sort({ createdAt: 1 }).skip(skip).limit(size).lean().maxTimeMS(MAX_QUERY_TIME_MS),
    Service.countDocuments(filter).maxTimeMS(MAX_QUERY_TIME_MS),
  ]);

  return {
    count: total,
    services: withSeoList(serializeDocs(services)),
    ...buildPageMeta(services, total, pageNum, size),
  };
}

export async function stats() {
  const [row] = await Service.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        popular: { $sum: { $cond: [{ $eq: ["$popular", true] }, 1, 0] } },
        features: { $sum: { $size: { $ifNull: ["$features", []] } } },
      },
    },
  ]).option({ maxTimeMS: MAX_QUERY_TIME_MS });

  return {
    total: row?.total ?? 0,
    popular: row?.popular ?? 0,
    features: row?.features ?? 0,
  };
}

export async function getBySlug(slug: string) {
  const service = await Service.findOne({ slug });
  if (!service) throw notFound(SERVICE_NOT_FOUND);
  return withSeo(service);
}

export async function create(body: Body) {
  const slug = await uniqueSlug(Service, body.slug?.trim() || body.title);
  const seo = requireValidSeo(body.seo);

  const service = await Service.create({ ...pick(body, SERVICE_FIELDS), slug, seo });
  await announceChange();
  return withSeo(service);
}

export async function update(id: string, body: Body) {
  const existing = await Service.findById(id);
  if (!existing) throw notFound(SERVICE_NOT_FOUND);

  const changes: Body = pick(body, SERVICE_FIELDS);

  // An explicit new slug is honoured. An ordinary edit keeps the existing slug.
  // A legacy record with no slug gets one.
  if (body.slug !== undefined && String(body.slug).trim()) {
    changes.slug = await uniqueSlug(Service, body.slug, existing._id);
  } else if (!existing.slug && body.title) {
    changes.slug = await uniqueSlug(Service, body.title, existing._id);
  }

  if (body.seo !== undefined) changes.seo = requireValidSeo(body.seo);

  const service = await Service.findByIdAndUpdate(id, changes, { new: true, runValidators: true });

  await removeFileIfUnused(existing.seo?.ogImage);
  await announceChange();
  return withSeo(service);
}

export async function remove(id: string) {
  const service = await Service.findByIdAndDelete(id);
  if (!service) throw notFound(SERVICE_NOT_FOUND);

  await removeFileIfUnused(service.seo?.ogImage);
  await announceChange();
}
