
import { Router } from 'express'
import {
  getProjects, getProjectById,
  createProject, updateProject, deleteProject,
} from '../controllers/project.controller'
import { protect } from '../middleware/auth'

const router = Router()

// Public
router.get('/',    getProjects)
router.get('/:id', getProjectById)

// Protected — dashboard only
router.post  ('/',    protect, createProject)
router.put   ('/:id', protect, updateProject)
router.delete('/:id', protect, deleteProject)

export default router