import { Router } from 'express'
import { body, param } from 'express-validator'
import {
  getUsers,
  createUser,
  updateUserRole,
  updateUserStatus,
  deleteUser,
} from '../controllers/user.controller'
import { protect, requireAdmin } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { USER_ROLES } from '../models/User'

const router = Router()

// Every user-management route requires authentication + the admin role.
router.use(protect, requireAdmin)

// GET /api/users — list users (q = optional email search)
router.get('/', getUsers)

// POST /api/users — create an account and assign a role
router.post(
  '/',
  validate([
    body('email')
      .trim()
      .isEmail()
      .withMessage('A valid email address is required.'),
    body('password')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be 8-128 characters.'),
    body('role')
      .isIn(USER_ROLES)
      .withMessage('Role must be admin, manager or editor.'),
  ]),
  createUser
)

// PATCH /api/users/:id/role — change a user's role
router.patch(
  '/:id/role',
  validate([
    param('id').isMongoId().withMessage('Invalid user ID.'),
    body('role').isIn(USER_ROLES).withMessage('Invalid role.'),
  ]),
  updateUserRole
)

// PATCH /api/users/:id/status — enable / disable an account
router.patch(
  '/:id/status',
  validate([
    param('id').isMongoId().withMessage('Invalid user ID.'),
    body('isActive').isBoolean().withMessage('isActive must be a boolean.'),
  ]),
  updateUserStatus
)

// DELETE /api/users/:id — delete a user (last-admin / self guards apply)
router.delete(
  '/:id',
  validate([param('id').isMongoId().withMessage('Invalid user ID.')]),
  deleteUser
)

export default router
