import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config/env'
import { User, USER_ROLES, UserRole } from '../models/User'

export interface AuthUserPayload {
  id: string
  email: string
  role: UserRole
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload
}

/**
 * Explicit role-based permission policy for CMS operations.
 *
 *  read    — Admin, Manager, Editor
 *  create  — Admin, Manager, Editor
 *  update  — Admin, Manager, Editor
 *  delete  — Admin, Manager
 *  users   — Admin only (user management / role assignment)
 */
export const CMS_PERMISSIONS: Record<string, readonly UserRole[]> = {
  read: USER_ROLES,
  create: USER_ROLES,
  update: USER_ROLES,
  delete: ['admin', 'manager'],
  users: ['admin'],
}

export type CmsPermission = keyof typeof CMS_PERMISSIONS

/**
 * Authentication responses must never be cached by a proxy, a browser or a
 * CDN — a cached 401/403 could otherwise be replayed to a different visitor.
 */
function noStore(res: Response): void {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Pragma', 'no-cache')
}

/**
 * Authentication only — verifies the JWT cookie, loads the user's CURRENT
 * role and account status from the database, and rejects missing, invalid,
 * expired, deleted or disabled accounts.
 *
 * Role and status are re-read on every request, so role changes and account
 * disabling take effect immediately without waiting for the JWT to expire.
 */
export const protect = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.cookies?.token

  if (!token) {
    noStore(res)
    res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    })
    return
  }

  let decoded: { id?: unknown }
  try {
    decoded = jwt.verify(token, JWT_SECRET) as { id?: unknown }
  } catch {
    noStore(res)
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
    })
    return
  }

  if (typeof decoded.id !== 'string') {
    noStore(res)
    res.status(401).json({
      success: false,
      message: 'Invalid token payload.',
    })
    return
  }

  const user = await User.findById(decoded.id).select('email role isActive')

  if (!user) {
    noStore(res)
    res.status(401).json({
      success: false,
      message: 'User no longer exists.',
    })
    return
  }

  if (user.isActive === false) {
    noStore(res)
    res.status(403).json({
      success: false,
      message: 'This account has been disabled. Contact the administrator.',
    })
    return
  }

  // A user with a missing/legacy/invalid role gets no access at all.
  if (!USER_ROLES.includes(user.role)) {
    noStore(res)
    res.status(403).json({
      success: false,
      message: 'Your account does not have a valid role assigned.',
    })
    return
  }

  req.user = {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
  }

  next()
}

/** 401 if somehow used without `protect`, 403 when the role is not permitted. */
export function requireRole(...roles: readonly UserRole[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated.',
      })
      return
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
      })
      return
    }
    next()
  }
}

/** Admin-only guard (user management, security-sensitive operations). */
export const requireAdmin = requireRole('admin')

/**
 * Role-based CMS permission guard, e.g. `requirePermission('delete')`.
 * Must run after `protect`.
 */
export function requirePermission(permission: CmsPermission) {
  const allowed = CMS_PERMISSIONS[permission] ?? []
  return requireRole(...allowed)
}
