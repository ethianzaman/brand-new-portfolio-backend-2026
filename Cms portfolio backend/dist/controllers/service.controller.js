"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServices = getServices;
exports.getServiceStats = getServiceStats;
exports.createService = createService;
exports.updateService = updateService;
exports.deleteService = deleteService;
const Service_1 = require("../models/Service");
const publish_1 = require("../lib/publish");
const query_1 = require("../utils/query");
const serialize_1 = require("../utils/serialize");
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
            services: (0, serialize_1.serializeDocs)(services),
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
        const service = await Service_1.Service.create(req.body);
        await (0, publish_1.publishChange)("services");
        res.status(201).json({
            success: true,
            message: "Service created successfully",
            service,
        });
    }
    catch (error) {
        console.error("[CREATE SERVICE ERROR]", error);
        await (0, publish_1.publishChange)("services");
        res.status(500).json({
            success: false,
            message: "Failed to create service",
        });
    }
}
async function updateService(req, res) {
    try {
        const service = await Service_1.Service.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (!service) {
            res.status(404).json({
                success: false,
                message: "Service not found",
            });
            return;
        }
        await (0, publish_1.publishChange)("services");
        res.status(200).json({
            success: true,
            service,
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
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
