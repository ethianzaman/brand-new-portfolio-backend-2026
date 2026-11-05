import { Router } from 'express'
import { changePassword, login, logout, getMe } from '../controllers/auth.controller'
import { protect } from '../middleware/auth'
import {
  changePasswordLimiter,
  loginAccountLimiter,
  loginIpLimiter,
} from '../middleware/rateLimit'

const router = Router()

router.post('/login', loginIpLimiter, loginAccountLimiter, login)
router.post('/logout', logout)

// Current authenticated user (role + status read fresh from the DB).
router.get('/me', protect, getMe)

router.post('/change-password', protect, changePasswordLimiter, changePassword)

export default router
