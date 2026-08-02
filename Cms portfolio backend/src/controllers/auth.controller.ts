import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { User } from '../models/User'
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/env';

console.log(process.env.JWT_SECRET);


// function signToken(id: string): string {
//   return jwt.sign({ id }, process.env.JWT_SECRET!, {
//     expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
//   })
// }

function signToken(id: string): string {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

// POST /api/auth/login
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body
    console.log("email",email);
    console.log("password",password);

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password required' })
      return
    }

    const user = await User.findOne({ email }).select('+password')
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ success: false, message: 'Invalid credentials' })
      return
    }

    const token = signToken(user.id)

    res.status(200).json({
      success: true,
      token,
      user: { id: user.id, email: user.email },
    })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

// GET /api/auth/me
export async function getMe(req: Request & { userId?: string }, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.userId)

    console.log(user);
    

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' })
      return
    }
    res.status(200).json({ success: true, user: { id: user.id, email: user.email } })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
}