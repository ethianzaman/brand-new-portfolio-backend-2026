import { Router } from 'express'
import { login, signUp, logout, getMe } from '../controllers/auth.controller'
import { protect } from '../middleware/auth'

const router = Router()

// Public registration is disabled — kept only for a clear 403 response.
router.post('/sign-up', signUp)
router.post('/login', login)
router.post('/logout', logout)

// Current authenticated user (role + status read fresh from the DB).
router.get('/me', protect, getMe)

export default router
