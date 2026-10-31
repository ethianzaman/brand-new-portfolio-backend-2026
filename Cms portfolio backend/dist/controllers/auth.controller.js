"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.getMe = exports.login = exports.signUp = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const env_1 = require("../config/env");
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
/**
 * Authentication responses must never be cached — a cached 200 could be
 * replayed to an anonymous visitor by a proxy or a CDN.
 */
function noStore(res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
}
/**
 * Public registration is DISABLED.
 *
 * Accounts are created exclusively by an Admin through the protected
 * User Management API (POST /api/users). The route is kept only so old
 * clients receive a clear message instead of a 404.
 */
const signUp = async (_req, res) => {
    res.status(403).json({
        success: false,
        message: 'Public registration is disabled. Ask an administrator to create your account.',
    });
};
exports.signUp = signUp;
const login = async (req, res) => {
    noStore(res);
    try {
        const { email, password } = req.body;
        if (typeof email !== 'string' || typeof password !== 'string') {
            res.status(400).json({
                success: false,
                message: 'Email and password are required.',
            });
            return;
        }
        const user = await User_1.User.findOne({
            email: email.trim().toLowerCase(),
        }).select('+password');
        if (!user || !(await user.comparePassword(password))) {
            res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
            return;
        }
        // Users with a missing/legacy/invalid role cannot sign in.
        if (!User_1.USER_ROLES.includes(user.role)) {
            res.status(403).json({
                success: false,
                message: 'Your account does not have a valid role. Ask an administrator to assign one.',
            });
            return;
        }
        if (user.isActive === false) {
            res.status(403).json({
                success: false,
                message: 'This account has been disabled. Contact the administrator.',
            });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: user._id.toString() }, env_1.JWT_SECRET, {
            expiresIn: env_1.JWT_EXPIRES_IN,
        });
        res.cookie('token', token, cookieOptions);
        res.status(200).json({
            success: true,
            message: 'Login successful',
            email: user.email,
            role: user.role,
            user: {
                id: user._id.toString(),
                email: user.email,
                role: user.role,
            },
        });
    }
    catch {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.login = login;
/**
 * GET /api/auth/me — current authenticated user, read fresh from the
 * database so the client always sees the CURRENT role and account status.
 */
const getMe = async (req, res) => {
    noStore(res);
    const user = await User_1.User.findById(req.user.id).select('email role isActive createdAt');
    if (!user) {
        res.status(401).json({ success: false, message: 'User no longer exists.' });
        return;
    }
    res.status(200).json({
        success: true,
        user: {
            id: user._id.toString(),
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt,
        },
    });
};
exports.getMe = getMe;
const logout = async (_req, res) => {
    noStore(res);
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
    res.status(200).json({ success: true, message: 'Logged out successfully' });
};
exports.logout = logout;
