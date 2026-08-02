import { Request, Response } from 'express'
import { Project } from '../models/Project'

// GET /api/projects — public, with pagination + filter
export async function getProjects(req: Request, res: Response): Promise<void> {
  try {
    const { category, page = '1', pageSize = '3' } = req.query

    const filter: Record<string, unknown> = {}
    if (category && category !== 'all') {
      filter.category = category
    }

    const pageNum  = parseInt(page as string)
    const size     = parseInt(pageSize as string)
    const skip     = (pageNum - 1) * size

    const [projects, total] = await Promise.all([
      Project.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size),
      Project.countDocuments(filter),
    ])

    res.status(200).json({
      success:  true,
      projects,
      total,
      hasMore:  skip + projects.length < total,
      page:     pageNum,
      pageSize: size,
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

// GET /api/projects/:id
export async function getProjectById(req: Request, res: Response): Promise<void> {
  try {
    const project = await Project.findById(req.params.id)
    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found' })
      return
    }
    res.status(200).json({ success: true, project })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

// POST /api/projects — protected
export async function createProject(req: Request, res: Response): Promise<void> {
  try {
    const project = await Project.create(req.body)
    res.status(201).json({ success: true, project })
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message })
  }
}

// PUT /api/projects/:id — protected
export async function updateProject(req: Request, res: Response): Promise<void> {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found' })
      return
    }
    res.status(200).json({ success: true, project })
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message })
  }
}

// DELETE /api/projects/:id — protected
export async function deleteProject(req: Request, res: Response): Promise<void> {
  try {
    const project = await Project.findByIdAndDelete(req.params.id)
    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found' })
      return
    }
    res.status(200).json({ success: true, message: 'Project deleted' })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
}