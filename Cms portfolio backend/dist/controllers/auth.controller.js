"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.getMe = getMe;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const env_1 = require("../config/env");
console.log(process.env.JWT_SECRET);
// function signToken(id: string): string {
//   return jwt.sign({ id }, process.env.JWT_SECRET!, {
//     expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
//   })
// }
function signToken(id) {
    return jsonwebtoken_1.default.sign({ id }, env_1.JWT_SECRET, { expiresIn: env_1.JWT_EXPIRES_IN });
}
// POST /api/auth/login
async function login(req, res) {
    try {
        const { email, password } = req.body;
        console.log("email", email);
        console.log("password", password);
        if (!email || !password) {
            res.status(400).json({ success: false, message: 'Email and password required' });
            return;
        }
        const user = await User_1.User.findOne({ email }).select('+password');
        if (!user || !(await user.comparePassword(password))) {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
            return;
        }
        const token = signToken(user.id);
        res.status(200).json({
            success: true,
            token,
            user: { id: user.id, email: user.email },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
// GET /api/auth/me
async function getMe(req, res) {
    try {
        const user = await User_1.User.findById(req.userId);
        console.log(user);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        res.status(200).json({ success: true, user: { id: user.id, email: user.email } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
