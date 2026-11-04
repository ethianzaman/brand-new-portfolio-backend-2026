"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServices = getServices;
exports.getServiceStats = getServiceStats;
exports.createService = createService;
exports.updateService = updateService;
exports.getServiceBySlug = getServiceBySlug;
exports.deleteService = deleteService;
const Service_1 = require("../models/Service");
const publish_1 = require("../lib/publish");
const query_1 = require("../utils/query");
const serialize_1 = require("../utils/serialize");
const seo_1 = require("../utils/seo");
const slug_1 = require("../utils/slug");
/** Attach a normalised `seo` object to a document (hydrated or lean). */
function withSeo(doc) {
    if (doc === null || doc === undefined) {
        return { seo: (0, seo_1.serializeSeo)(undefined) };
    }
    const plain = typeof doc.toObject === "function"
        ? doc.toObject()
        : doc;
    return { ...plain, seo: (0, seo_1.serializeSeo)(plain.seo) };
}
function withSeoList(docs) {
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
async function getServices(req, res) {
    try {
        const { page, pageSize, q } = req.query;
        const filter = {};
        const rx = (0, query_1.buildSearchRegex)(q);
        if (rx) {
            filter.$or = [
                { title: rx },
                { description: rx },
                { tags: rx },
                { "features.text": rx },
            ];
        }
        const pageNum = (0, query_1.clampInt)(page, 1, 1, 10000);
        const size = (0, query_1.clampInt)(pageSize, query_1.MAX_PAGE_SIZE, 1, query_1.MAX_PAGE_SIZE);
        const skip = (pageNum - 1) * size;
        const [services, total] = await Promise.all([
            Service_1.Service.find(filter)
                .sort({ createdAt: 1 })
                .skip(skip)
                .limit(size)
                .lean()
                .maxTimeMS(query_1.MAX_QUERY_TIME_MS),
            Service_1.Service.countDocuments(filter).maxTimeMS(query_1.MAX_QUERY_TIME_MS),
        ]);
        res.status(200).json({
            success: true,
            count: total,
            services: withSeoList((0, serialize_1.serializeDocs)(services)),
            ...(0, query_1.buildPageMeta)(services, total, pageNum, size),
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: process.env.NODE_ENV === "development" ? error : undefined,
        });
    }
}
// GET /api/services/stats — dashboard stat cards
async function getServiceStats(_req, res) {
    try {
        const [row] = await Service_1.Service.aggregate([
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
        ]).option({ maxTimeMS: query_1.MAX_QUERY_TIME_MS });
        res.status(200).json({
            success: true,
            stats: {
                total: row?.total ?? 0,
                popular: row?.popular ?? 0,
                features: row?.features ?? 0,
            },
        });
    }
    catch {
        res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
}
async function createService(req, res) {
    try {
        // Slug: explicit value wins, otherwise derive from the title.
        const slug = await (0, slug_1.uniqueSlug)(Service_1.Service, req.body.slug?.trim() || req.body.title);
        const seo = (0, seo_1.normaliseSeo)(req.body.seo);
        if (seo === null) {
            res.status(400).json({
                success: false,
                message: "Invalid SEO data: canonicalUrl and ogImage must be https URLs or same-site paths",
            });
            return;
        }
        const service = await Service_1.Service.create({ ...req.body, slug, seo });
        await (0, publish_1.publishChange)("services");
        await (0, publish_1.publishChange)("seo");
        res.status(201).json({
            success: true,
            message: "Service created successfully",
            service: withSeo(service),
        });
    }
    catch (error) {
        console.error("[CREATE SERVICE ERROR]", error);
        res.status(500).json({
            success: false,
            message: "Failed to create service",
        });
    }
}
async function updateService(req, res) {
    try {
        const existing = await Service_1.Service.findById(req.params.id);
        if (!existing) {
            res.status(404).json({
                success: false,
                message: "Service not found",
            });
            return;
        }
        const updateData = { ...req.body };
        // Slug policy: honour an explicit new slug; preserve the existing one on an
        // ordinary edit; generate one for a legacy record with no slug.
        if (req.body.slug !== undefined && String(req.body.slug).trim()) {
            updateData.slug = await (0, slug_1.uniqueSlug)(Service_1.Service, req.body.slug, existing._id);
        }
        else if (!existing.slug && req.body.title) {
            updateData.slug = await (0, slug_1.uniqueSlug)(Service_1.Service, req.body.title, existing._id);
        }
        if (req.body.seo !== undefined) {
            const seo = (0, seo_1.normaliseSeo)(req.body.seo);
            if (seo === null) {
                res.status(400).json({
                    success: false,
                    message: "Invalid SEO data: canonicalUrl and ogImage must be https URLs or same-site paths",
                });
                return;
            }
            updateData.seo = seo;
        }
        const service = await Service_1.Service.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true,
        });
        await (0, publish_1.publishChange)("services");
        await (0, publish_1.publishChange)("seo");
        res.status(200).json({
            success: true,
            service: withSeo(service),
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}
// GET /api/services/slug/:slug — public single service by slug.
async function getServiceBySlug(req, res) {
    try {
        const service = await Service_1.Service.findOne({ slug: req.params.slug });
        if (!service) {
            res.status(404).json({ success: false, message: "Service not found" });
            return;
        }
        res.status(200).json({ success: true, service: withSeo(service) });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
async function deleteService(req, res) {
    try {
        const service = await Service_1.Service.findByIdAndDelete(req.params.id);
        if (!service) {
            res.status(404).json({
                success: false,
                message: "Service not found",
            });
            return;
        }
        await (0, publish_1.publishChange)("services");
        await (0, publish_1.publishChange)("seo");
        res.status(200).json({
            success: true,
            message: "Service deleted successfully",
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}
