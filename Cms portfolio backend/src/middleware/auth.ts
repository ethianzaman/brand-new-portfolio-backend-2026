import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/env';

export interface AuthRequest extends Request {
  userId?: string
}

// export function protect(
//   req: AuthRequest,
//   res: Response,
//   next: NextFunction
// ): void {
//   const header = req.headers.authorization
//   console.log('Authorization header:', header)

//   if (!header || !header.startsWith('Bearer ')) {
//     res.status(401).json({ success: false, message: 'Not authorized' })
//     return
//   }

//   const token = header.split(' ')[1]

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }
//     req.userId = decoded.id
//     next()
//   } catch {
//     res.status(401).json({ success: false, message: 'Token invalid or expired' })
//   }
// }

// এক্সপ্রেস রিকোয়েস্টের সাথে ইউজার যুক্ত করে একটি কাস্টম ইন্টারফেস তৈরি
interface AuthenticatedRequest extends Request {
  user?: {
    id: string
  }
}

export const protect = async (
  req: AuthenticatedRequest, // এখানে Request এর বদলে আমাদের কাস্টম ইন্টারফেস ব্যবহার করছি
  res: Response, 
  next: NextFunction
): Promise<void> => {
  const token = req.cookies?.token

  if (!token) {
    res.status(401).json({ message: 'Access denied. No token provided.' })
    return
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string }
    
    // এখন আর টাইপ এরর আসবে না
    req.user = { id: decoded.id } 
    next()
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token.' })
  }
}