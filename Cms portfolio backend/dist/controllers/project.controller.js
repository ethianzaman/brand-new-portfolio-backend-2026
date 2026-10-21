"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjects = getProjects;
exports.getProjectById = getProjectById;
exports.createProject = createProject;
exports.updateProject = updateProject;
exports.deleteProject = deleteProject;
exports.getAllProjects = getAllProjects;
exports.getProjectStats = getProjectStats;
const Project_1 = require("../models/Project");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const publish_1 = require("../lib/publish");
const query_1 = require("../utils/query");
const serialize_1 = require("../utils/serialize");
/** Fields the dashboard list is allowed to sort by. */
const PROJECT_SORT_FIELDS = [
    "title",
    "category",
    "createdAt",
    "featured",
];
// GET /api/projects — public, with pagination + filter
async function getProjects(req, res) {
    try {
        const { category, page = "1", pageSize = "3" } = req.query;
        const filter = {};
        if (category && category !== "all") {
            filter.category = category;
        }
        const pageNum = (0, query_1.clampInt)(page, 1, 1, 10000);
        const size = (0, query_1.clampInt)(pageSize, 3, 1, query_1.MAX_PAGE_SIZE);
        const skip = (pageNum - 1) * size;
        const [projects, total] = await Promise.all([
            Project_1.Project.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(size)
                .lean()
                .maxTimeMS(query_1.MAX_QUERY_TIME_MS),
            Project_1.Project.countDocuments(filter).maxTimeMS(query_1.MAX_QUERY_TIME_MS),
        ]);
        res.status(200).json({
            success: true,
            projects: (0, serialize_1.serializeDocs)(projects),
            ...(0, query_1.buildPageMeta)(projects, total, pageNum, size),
        });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
// GET /api/projects/:id
async function getProjectById(req, res) {
    try {
        const project = await Project_1.Project.findById(req.params.id);
        if (!project) {
            res.status(404).json({ success: false, message: "Project not found" });
            return;
        }
        res.status(200).json({ success: true, project });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
// POST /api/projects — protected
async function createProject(req, res) {
    try {
        let thumbnail = req.body.thumbnail;
        // যদি file upload আসে
        if (req.file) {
            thumbnail = await (0, uploadMiddleware_1.uploadToCloudinary)(req.file.buffer, "portfolio/projects");
        }
        const project = await Project_1.Project.create({
            ...req.body,
            thumbnail,
        });
        await (0, publish_1.publishChange)("projects");
        res.status(201).json({
            success: true,
            project,
        });
    }
    catch (err) {
        res.status(400).json({
            success: false,
            message: err.message,
        });
    }
}
// PUT /api/projects/:id — protected
async function updateProject(req, res) {
    try {
        const project = await Project_1.Project.findById(req.params.id);
        if (!project) {
            res.status(404).json({
                success: false,
                message: "Project not found",
            });
            return;
        }
        const updateData = {
            ...req.body,
        };
        // tags আসে FormData থেকে
        if (req.body.tags) {
            updateData.tags = Array.isArray(req.body.tags)
                ? req.body.tags
                : [req.body.tags];
        }
        // featured string → boolean
        if (req.body.featured !== undefined) {
            updateData.featured = req.body.featured === "true";
        }
        // নতুন image upload হলে
        if (req.file) {
            // পুরানো cloudinary image delete
            if (project.thumbnail) {
                await (0, uploadMiddleware_1.deleteFromCloudinary)(project.thumbnail);
            }
            updateData.thumbnail = await (0, uploadMiddleware_1.uploadToCloudinary)(req.file.buffer, "portfolio/projects");
        }
        const updatedProject = await Project_1.Project.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true,
        });
        await (0, publish_1.publishChange)("projects");
        res.status(200).json({
            success: true,
            project: updatedProject,
        });
    }
    catch (err) {
        res.status(400).json({
            success: false,
            message: err.message,
        });
    }
}
async function deleteProject(req, res) {
    try {
        const project = await Project_1.Project.findById(req.params.id);
        if (!project) {
            res.status(404).json({
                success: false,
                message: "Project not found",
            });
            return;
        }
        // Delete image from Cloudinary
        if (project.thumbnail) {
            await (0, uploadMiddleware_1.deleteFromCloudinary)(project.thumbnail);
        }
        // Delete project from MongoDB
        await project.deleteOne();
        await (0, publish_1.publishChange)("projects");
        res.status(200).json({
            success: true,
            message: "Project deleted successfully",
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: err.message || "Server error",
        });
    }
}
// GET /api/projects/all — dashboard list, paginated + searchable
//
// Query: ?page=1&pageSize=10&q=react&category=all&sort=title&dir=asc
async function getAllProjects(req, res) {
    try {
        const { page, pageSize, q, category, sort, dir } = req.query;
        const pageNum = (0, query_1.clampInt)(page, 1, 1, 10000);
        const size = (0, query_1.clampInt)(pageSize, query_1.DEFAULT_PAGE_SIZE, 1, query_1.MAX_PAGE_SIZE);
        const skip = (pageNum - 1) * size;
        const filter = {};
        if (typeof category === "string" && category !== "all") {
            filter.category = category;
        }
        const rx = (0, query_1.buildSearchRegex)(q);
        if (rx) {
            filter.$or = [
                { title: rx },
                { description: rx },
                { tags: rx },
                { category: rx },
            ];
        }
        const sortSpec = (0, query_1.resolveSort)(sort, dir, PROJECT_SORT_FIELDS, {
            createdAt: -1,
        });
        const [projects, total] = await Promise.all([
            Project_1.Project.find(filter)
                .sort(sortSpec)
                .skip(skip)
                .limit(size)
                .lean()
                .maxTimeMS(query_1.MAX_QUERY_TIME_MS),
            Project_1.Project.countDocuments(filter).maxTimeMS(query_1.MAX_QUERY_TIME_MS),
        ]);
        res.status(200).json({
            success: true,
            projects: (0, serialize_1.serializeDocs)(projects),
            ...(0, query_1.buildPageMeta)(projects, total, pageNum, size),
        });
    }
    catch {
        res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
}
// GET /api/projects/stats — dashboard stat cards
async function getProjectStats(_req, res) {
    try {
        const [row] = await Project_1.Project.aggregate([
            {
                $facet: {
                    byCategory: [
                        { $group: { _id: "$category", count: { $sum: 1 } } },
                    ],
                    featured: [
                        { $match: { featured: true } },
                        { $count: "count" },
                    ],
                },
            },
        ]).option({ maxTimeMS: query_1.MAX_QUERY_TIME_MS });
        const byCategory = {};
        for (const entry of row?.byCategory ?? []) {
            byCategory[String(entry._id)] = entry.count;
        }
        const total = Object.values(byCategory).reduce((sum, n) => sum + n, 0);
        res.status(200).json({
            success: true,
            stats: {
                total,
                featured: row?.featured?.[0]?.count ?? 0,
                byCategory,
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
