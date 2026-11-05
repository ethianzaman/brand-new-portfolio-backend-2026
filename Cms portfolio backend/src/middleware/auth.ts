import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config/env'
import { User, USER_ROLES, UserRole } from '../models/User'
import { permissionsForRole, type PermissionKey } from '../lib/permissions'
import { publicMessage } from '../utils/request'

export interface AuthUserPayload {
  id: string
  email: string
  role: UserRole
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload
}

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

  let decoded: { id?: unknown; v?: unknown }
  try {
    decoded = jwt.verify(token, JWT_SECRET) as { id?: unknown; v?: unknown }
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

  const user = await User.findById(decoded.id).select('email role isActive tokenVersion')

  if (!user) {
    noStore(res)
    res.status(401).json({
      success: false,
      message: 'User no longer exists.',
    })
    return
  }

  // Tokens issued before the version existed count as version 0.
  if ((decoded.v ?? 0) !== (user.tokenVersion ?? 0)) {
    noStore(res)
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
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

/** For what only a Super Admin may do, such as changing what roles can access. */
export const requireSuperAdmin = requireRole('super_admin')

/**
 * Checks the current role's stored permissions, so a change made in the
 * dashboard applies without anyone signing in again. Must run after `protect`.
 */
export function requirePermission(permission: PermissionKey) {
  return requireAnyPermission([permission])
}

/** Like requirePermission, for an action several sections share. */
export function requireAnyPermission(permissions: PermissionKey[]) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated.' })
      return
    }

    try {
      const granted = await permissionsForRole(req.user.role)
      if (!permissions.some((permission) => granted.includes(permission))) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to perform this action.',
        })
        return
      }
      next()
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        message: publicMessage(err, 'Could not verify your permissions.'),
      })
    }
  }
}
