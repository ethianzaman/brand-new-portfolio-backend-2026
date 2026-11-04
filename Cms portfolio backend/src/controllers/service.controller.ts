import { Request, Response } from "express";
import { Service } from "../models/Service";
import { publishChange } from "../lib/publish";
import {
  buildPageMeta,
  buildSearchRegex,
  clampInt,
  MAX_PAGE_SIZE,
  MAX_QUERY_TIME_MS,
} from "../utils/query";
import { serializeDocs } from "../utils/serialize";
import { normaliseSeo, serializeSeo } from "../utils/seo";
import { uniqueSlug } from "../utils/slug";

/** Attach a normalised `seo` object to a document (hydrated or lean). */
function withSeo(doc: unknown): Record<string, unknown> {
  if (doc === null || doc === undefined) {
    return { seo: serializeSeo(undefined) };
  }
  const plain =
    typeof (doc as any).toObject === "function"
      ? (doc as any).toObject()
      : (doc as Record<string, unknown>);
  return { ...plain, seo: serializeSeo((plain as any).seo) };
}

function withSeoList(docs: unknown[]) {
  return docs.map((doc) => withSeo(doc));
}

/**
 * `GET /api/services` — public list + dashboard list.
 *
 * Query: ?page=1&pageSize=10&q=api
 *
 * The default page size is deliberately generous: the public `/services` grid
 * renders every service, so the endpoint still answers with the full set
 * (bounded at `MAX_PAGE_SIZE`) when no page size is requested. The dashboard
 * passes an explicit `pageSize` and gets one page back.
 */
export async function getServices(req: Request, res: Response): Promise<void> {
  try {
    const { page, pageSize, q } = req.query;

    const filter: Record<string, unknown> = {};

    const rx = buildSearchRegex(q);
    if (rx) {
      filter.$or = [
        { title: rx },
        { description: rx },
        { tags: rx },
        { "features.text": rx },
      ];
    }

    const pageNum = clampInt(page, 1, 1, 10_000);
    const size = clampInt(pageSize, MAX_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const skip = (pageNum - 1) * size;

    const [services, total] = await Promise.all([
      Service.find(filter)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(size)
        .lean()
        .maxTimeMS(MAX_QUERY_TIME_MS),
      Service.countDocuments(filter).maxTimeMS(MAX_QUERY_TIME_MS),
    ]);

    res.status(200).json({
      success: true,
      count: total,
      services: withSeoList(serializeDocs(services)),
      ...buildPageMeta(services, total, pageNum, size),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
}

// GET /api/services/stats — dashboard stat cards
export async function getServiceStats(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const [row] = await Service.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          popular: {
            $sum: { $cond: [{ $eq: ["$popular", true] }, 1, 0] },
          },
          features: {
            $sum: { $size: { $ifNull: ["$features", []] } },
          },
        },
      },
    ]).option({ maxTimeMS: MAX_QUERY_TIME_MS });

    res.status(200).json({
      success: true,
      stats: {
        total: row?.total ?? 0,
        popular: row?.popular ?? 0,
        features: row?.features ?? 0,
      },
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

export async function createService(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    // Slug: explicit value wins, otherwise derive from the title.
    const slug = await uniqueSlug(
      Service,
      req.body.slug?.trim() || req.body.title,
    );

    const seo = normaliseSeo(req.body.seo);
    if (seo === null) {
      res.status(400).json({
        success: false,
        message:
          "Invalid SEO data: canonicalUrl and ogImage must be https URLs or same-site paths",
      });
      return;
    }

    const service = await Service.create({ ...req.body, slug, seo });
    await publishChange("services");
    await publishChange("seo");
    res.status(201).json({
      success: true,
      message: "Service created successfully",
      service: withSeo(service),
    });
  } catch (error) {
    console.error("[CREATE SERVICE ERROR]", error);
    res.status(500).json({
      success: false,
      message: "Failed to create service",
    });
  }
}

export async function updateService(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const existing = await Service.findById(req.params.id);
    if (!existing) {
      res.status(404).json({
        success: false,
        message: "Service not found",
      });
      return;
    }

    const updateData: Record<string, unknown> = { ...req.body };

    // Slug policy: honour an explicit new slug; preserve the existing one on an
    // ordinary edit; generate one for a legacy record with no slug.
    if (req.body.slug !== undefined && String(req.body.slug).trim()) {
      updateData.slug = await uniqueSlug(Service, req.body.slug, existing._id);
    } else if (!existing.slug && req.body.title) {
      updateData.slug = await uniqueSlug(Service, req.body.title, existing._id);
    }

    if (req.body.seo !== undefined) {
      const seo = normaliseSeo(req.body.seo);
      if (seo === null) {
        res.status(400).json({
          success: false,
          message:
            "Invalid SEO data: canonicalUrl and ogImage must be https URLs or same-site paths",
        });
        return;
      }
      updateData.seo = seo;
    }

    const service = await Service.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    await publishChange("services");
    await publishChange("seo");
    res.status(200).json({
      success: true,
      service: withSeo(service),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

// GET /api/services/slug/:slug — public single service by slug.
export async function getServiceBySlug(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const service = await Service.findOne({ slug: req.params.slug });
    if (!service) {
      res.status(404).json({ success: false, message: "Service not found" });
      return;
    }
    res.status(200).json({ success: true, service: withSeo(service) });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function deleteService(
  req: Request,
  res: Response,
): Promise<void> {

  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) {

      res.status(404).json({
        success: false,
        message: "Service not found",
      });

      return;
    }

    await publishChange("services");
    await publishChange("seo");
    res.status(200).json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error: any) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
