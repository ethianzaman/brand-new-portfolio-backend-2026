import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { User } from '../models/User'
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/env';


const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // ৭ দিন মেয়াদ
}

// ১. সাইনআপ (নতুন এডমিন বা ইউজার ক্রিয়েট করার জন্য)
export const signUp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body

    const userExists = await User.findOne({ email })
    if (userExists) {
      res.status(400).json({ message: 'User already exists' })
      return
    }

    const user = await User.create({ email, password })
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' })

    res.cookie('token', token, cookieOptions)
    res.status(201).json({ message: 'Registration successful', email: user.email })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error })
  }
}

// ২. লগইন (টোকেন কুকিতে পুশ করা হবে)
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email }).select('+password')
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ message: 'Invalid email or password' })
      return
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' })

    res.cookie('token', token, cookieOptions)
    res.status(200).json({ message: 'Login successful', email: user.email })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error })
  }
}

// ৩. লগআউট (কুকি ক্লিয়ার করা হবে)
export const logout = async (req: Request, res: Response): Promise<void> => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  })
  res.status(200).json({ message: 'Logged out successfully' })
}