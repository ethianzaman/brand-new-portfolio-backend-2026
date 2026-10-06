"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjects = getProjects;
exports.getProjectById = getProjectById;
exports.createProject = createProject;
exports.updateProject = updateProject;
exports.deleteProject = deleteProject;
exports.getAllProjects = getAllProjects;
const Project_1 = require("../models/Project");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
// GET /api/projects — public, with pagination + filter
async function getProjects(req, res) {
    try {
        const { category, page = "1", pageSize = "3" } = req.query;
        const filter = {};
        if (category && category !== "all") {
            filter.category = category;
        }
        const pageNum = parseInt(page);
        const size = parseInt(pageSize);
        const skip = (pageNum - 1) * size;
        const [projects, total] = await Promise.all([
            Project_1.Project.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size),
            Project_1.Project.countDocuments(filter),
        ]);
        res.status(200).json({
            success: true,
            projects,
            total,
            hasMore: skip + projects.length < total,
            page: pageNum,
            pageSize: size,
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
// DELETE /api/projects/:id — protected
// export async function deleteProject(
//   req: Request,
//   res: Response,
// ): Promise<void> {
//   try {
//     const project = await Project.findByIdAndDelete(req.params.id);
//     if (!project) {
//       res.status(404).json({ success: false, message: "Project not found" });
//       return;
//     }
//     res.status(200).json({ success: true, message: "Project deleted" });
//   } catch {
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// }
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
async function getAllProjects(req, res) {
    try {
        const projects = await Project_1.Project.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            projects,
        });
    }
    catch {
        res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
}
