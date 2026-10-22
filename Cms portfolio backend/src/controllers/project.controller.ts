import { Request, Response } from "express";
import { Project } from "../models/Project";
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
const PROJECT_SORT_FIELDS = [
  "title",
  "category",
  "createdAt",
  "featured",
] as const;

// GET /api/projects — public, with pagination + filter
export async function getProjects(req: Request, res: Response): Promise<void> {
  try {
    const { category, page = "1", pageSize = "3" } = req.query;

    const filter: Record<string, unknown> = {};
    if (category && category !== "all") {
      filter.category = category;
    }

    const pageNum = clampInt(page, 1, 1, 10_000);
    const size = clampInt(pageSize, 3, 1, MAX_PAGE_SIZE);
    const skip = (pageNum - 1) * size;

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(size)
        .lean()
        .maxTimeMS(MAX_QUERY_TIME_MS),
      Project.countDocuments(filter).maxTimeMS(MAX_QUERY_TIME_MS),
    ]);

    res.status(200).json({
      success: true,
      projects: serializeDocs(projects),
      ...buildPageMeta(projects, total, pageNum, size),
    });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}
// GET /api/projects/:id
export async function getProjectById(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      res.status(404).json({ success: false, message: "Project not found" });
      return;
    }
    res.status(200).json({ success: true, project });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// POST /api/projects — protected
export async function createProject(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    let thumbnail = req.body.thumbnail;

    // যদি file upload আসে
    if (req.file) {
      thumbnail = await uploadToCloudinary(
        req.file.buffer,
        "portfolio/projects",
      );
    }

    const project = await Project.create({
      ...req.body,
      thumbnail,
    });

    await publishChange("projects");

    res.status(201).json({
      success: true,
      project,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
}

// PUT /api/projects/:id — protected
export async function updateProject(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      res.status(404).json({
        success: false,
        message: "Project not found",
      });
      return;
    }

    const updateData: any = {
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
        await deleteFromCloudinary(project.thumbnail);
      }

      updateData.thumbnail = await uploadToCloudinary(
        req.file.buffer,
        "portfolio/projects",
      );
    }

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      },
    );

    await publishChange("projects");

    res.status(200).json({
      success: true,
      project: updatedProject,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
}


export async function deleteProject(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      res.status(404).json({
        success: false,
        message: "Project not found",
      });
      return;
    }

    // Delete image from Cloudinary
    if (project.thumbnail) {
      await deleteFromCloudinary(project.thumbnail);
    }

    // Delete project from MongoDB
    await project.deleteOne();
    await publishChange("projects");
    res.status(200).json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
}

// GET /api/projects/all — dashboard list, paginated + searchable
//
// Query: ?page=1&pageSize=10&q=react&category=all&sort=title&dir=asc
export async function getAllProjects(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { page, pageSize, q, category, sort, dir } = req.query;

    const pageNum = clampInt(page, 1, 1, 10_000);
    const size = clampInt(pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const skip = (pageNum - 1) * size;

    const filter: Record<string, unknown> = {};
    if (typeof category === "string" && category !== "all") {
      filter.category = category;
    }

    const rx = buildSearchRegex(q);
    if (rx) {
      filter.$or = [
        { title: rx },
        { description: rx },
        { tags: rx },
        { category: rx },
      ];
    }

    const sortSpec = resolveSort(sort, dir, PROJECT_SORT_FIELDS, {
      createdAt: -1,
    });

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .sort(sortSpec)
        .skip(skip)
        .limit(size)
        .lean()
        .maxTimeMS(MAX_QUERY_TIME_MS),
      Project.countDocuments(filter).maxTimeMS(MAX_QUERY_TIME_MS),
    ]);

    res.status(200).json({
      success: true,
      projects: serializeDocs(projects),
      ...buildPageMeta(projects, total, pageNum, size),
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

// GET /api/projects/stats — dashboard stat cards
export async function getProjectStats(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const [row] = await Project.aggregate([
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
    ]).option({ maxTimeMS: MAX_QUERY_TIME_MS });

    const byCategory: Record<string, number> = {};
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
  } catch {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}
