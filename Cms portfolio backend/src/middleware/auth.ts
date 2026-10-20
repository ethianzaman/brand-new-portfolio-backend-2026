// import { Request, Response, NextFunction } from 'express'
// import jwt from 'jsonwebtoken'
// import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/env';

// export interface AuthRequest extends Request {
//   userId?: string
// }


// // এক্সপ্রেস রিকোয়েস্টের সাথে ইউজার যুক্ত করে একটি কাস্টম ইন্টারফেস তৈরি
// interface AuthenticatedRequest extends Request {
//   user?: {
//     id: string
//   }
// }

// export const protect = async (
//   req: AuthenticatedRequest, // এখানে Request এর বদলে আমাদের কাস্টম ইন্টারফেস ব্যবহার করছি
//   res: Response, 
//   next: NextFunction
// ): Promise<void> => {
//   const token = req.cookies?.token

//   if (!token) {
//     res.status(401).json({ message: 'Access denied. No token provided.' })
//     return
//   }

//   try {
//     const decoded = jwt.verify(token, JWT_SECRET) as { id: string }

//     // এখন আর টাইপ এরর আসবে না
//     req.user = { id: decoded.id } 
//     next()
//   } catch (error) {
//     res.status(401).json({ message: 'Invalid or expired token.' })
//   }
// }


import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config/env'
import { User } from '../models/User' // তোমার actual User model path ব্যবহার করবে

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    role: string
  }
}

export const protect = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.cookies?.token

  if (!token) {
    res.status(401).json({
      message: 'Access denied. No token provided.',
    })
    return
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string }

    const user = await User.findById(decoded.id).select('role')

    if (!user) {
      res.status(401).json({
        message: 'User no longer exists.',
      })
      return
    }
    if (user.role !== 'admin') {
      res.status(403).json({
        message: 'Admin access required',
      })
      return
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
    }

    next()
  } catch {
    res.status(401).json({
      message: 'Invalid or expired token.',
    })
  }
}