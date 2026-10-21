import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from './auth'


export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({
      message: 'Access denied. Admin permission required.',
    })
    return
  }

  next()
}