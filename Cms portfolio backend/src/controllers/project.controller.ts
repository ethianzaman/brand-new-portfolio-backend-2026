import { handle, WRITE_FAILURE } from "../lib/http";
import * as projects from "../services/project.service";
import type { ProjectFiles } from "../services/project.service";

export const getProjects = handle(async (req, res) => {
  res.status(200).json({ success: true, ...(await projects.listPublic(req.query)) });
});

export const getAllProjects = handle(async (req, res) => {
  res.status(200).json({ success: true, ...(await projects.listForDashboard(req.query)) });
});

export const getProjectStats = handle(async (_req, res) => {
  res.status(200).json({ success: true, stats: await projects.stats() });
});

export const getProjectById = handle(async (req, res) => {
  res.status(200).json({ success: true, project: await projects.getById(req.params.id) });
});

export const getProjectBySlug = handle(async (req, res) => {
  res.status(200).json({ success: true, project: await projects.getBySlug(req.params.slug) });
});

export const createProject = handle(async (req, res) => {
  const project = await projects.create(req.body, req.files as ProjectFiles | undefined);
  res.status(201).json({ success: true, project });
}, WRITE_FAILURE);

export const updateProject = handle(async (req, res) => {
  const project = await projects.update(
    req.params.id,
    req.body,
    req.files as ProjectFiles | undefined,
  );
  res.status(200).json({ success: true, project });
}, WRITE_FAILURE);

export const deleteProject = handle(
  async (req, res) => {
    await projects.remove(req.params.id);
    res.status(200).json({ success: true, message: "Project deleted successfully" });
  },
  { status: 500, message: "Server error" },
);
