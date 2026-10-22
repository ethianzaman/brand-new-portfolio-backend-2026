import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { User, USER_ROLES } from '../models/User'
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/env'
import { AuthenticatedRequest } from '../middleware/auth'

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
}

/**
 * Public registration is DISABLED.
 *
 * Accounts are created exclusively by an Admin through the protected
 * User Management API (POST /api/users). The route is kept only so old
 * clients receive a clear message instead of a 404.
 */
export const signUp = async (_req: Request, res: Response): Promise<void> => {
  res.status(403).json({
    success: false,
    message:
      'Public registration is disabled. Ask an administrator to create your account.',
  })
}

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body

    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      })
      return
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select('+password')

    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      })
      return
    }

    // Users with a missing/legacy/invalid role cannot sign in.
    if (!USER_ROLES.includes(user.role)) {
      res.status(403).json({
        success: false,
        message:
          'Your account does not have a valid role. Ask an administrator to assign one.',
      })
      return
    }

    if (user.isActive === false) {
      res.status(403).json({
        success: false,
        message: 'This account has been disabled. Contact the administrator.',
      })
      return
    }

    const token = jwt.sign({ id: user._id.toString() }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    })

    res.cookie('token', token, cookieOptions)

    res.status(200).json({
      success: true,
      message: 'Login successful',
      email: user.email,
      role: user.role,
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

/**
 * GET /api/auth/me — current authenticated user, read fresh from the
 * database so the client always sees the CURRENT role and account status.
 */
export const getMe = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const user = await User.findById(req.user!.id).select(
    'email role isActive createdAt'
  )

  if (!user) {
    res.status(401).json({ success: false, message: 'User no longer exists.' })
    return
  }

  res.status(200).json({
    success: true,
    user: {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    },
  })
}

export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  })
  res.status(200).json({ success: true, message: 'Logged out successfully' })
}
