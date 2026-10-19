"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.login = exports.signUp = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const env_1 = require("../config/env");
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // ৭ দিন মেয়াদ
};
// ১. সাইনআপ (নতুন এডমিন বা ইউজার ক্রিয়েট করার জন্য)
const signUp = async (req, res) => {
    try {
        const { email, password } = req.body;
        const userExists = await User_1.User.findOne({ email });
        if (userExists) {
            res.status(400).json({ message: 'User already exists' });
            return;
        }
        const user = await User_1.User.create({ email, password });
        const token = jsonwebtoken_1.default.sign({ id: user._id }, env_1.JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, cookieOptions);
        res.status(201).json({ message: 'Registration successful', email: user.email });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
exports.signUp = signUp;
// ২. লগইন (টোকেন কুকিতে পুশ করা হবে)
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User_1.User.findOne({ email }).select('+password');
        if (!user || !(await user.comparePassword(password))) {
            res.status(401).json({ message: 'Invalid email or password' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: user._id }, env_1.JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, cookieOptions);
        res.status(200).json({ message: 'Login successful', email: user.email });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
exports.login = login;
// ৩. লগআউট (কুকি ক্লিয়ার করা হবে)
const logout = async (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
    res.status(200).json({ message: 'Logged out successfully' });
};
exports.logout = logout;
