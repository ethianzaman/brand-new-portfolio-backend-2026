import { Request, Response } from "express";
import { Project } from "../models/Project";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../middleware/uploadMiddleware";

// GET /api/projects — public, with pagination + filter
export async function getProjects(req: Request, res: Response): Promise<void> {
  try {
    const { category, page = "1", pageSize = "3" } = req.query;

    const filter: Record<string, unknown> = {};
    if (category && category !== "all") {
      filter.category = category;
    }

    const pageNum = parseInt(page as string);
    const size = parseInt(pageSize as string);
    const skip = (pageNum - 1) * size;

    const [projects, total] = await Promise.all([
      Project.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size),
      Project.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      projects,
      total,
      hasMore: skip + projects.length < total,
      page: pageNum,
      pageSize: size,
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

export async function getAllProjects(req: Request, res: Response) {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      projects,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}
