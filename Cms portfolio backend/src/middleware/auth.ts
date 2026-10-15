import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/env';

export interface AuthRequest extends Request {
  userId?: string
}


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