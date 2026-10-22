"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.protect = exports.CMS_PERMISSIONS = void 0;
exports.requireRole = requireRole;
exports.requirePermission = requirePermission;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const User_1 = require("../models/User");
/**
 * Explicit role-based permission policy for CMS operations.
 *
 *  read    — Admin, Manager, Editor
 *  create  — Admin, Manager, Editor
 *  update  — Admin, Manager, Editor
 *  delete  — Admin, Manager
 *  users   — Admin only (user management / role assignment)
 */
exports.CMS_PERMISSIONS = {
    read: User_1.USER_ROLES,
    create: User_1.USER_ROLES,
    update: User_1.USER_ROLES,
    delete: ['admin', 'manager'],
    users: ['admin'],
};
/**
 * Authentication only — verifies the JWT cookie, loads the user's CURRENT
 * role and account status from the database, and rejects missing, invalid,
 * expired, deleted or disabled accounts.
 *
 * Role and status are re-read on every request, so role changes and account
 * disabling take effect immediately without waiting for the JWT to expire.
 */
const protect = async (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        res.status(401).json({
            success: false,
            message: 'Access denied. No token provided.',
        });
        return;
    }
    let decoded;
    try {
        decoded = jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET);
    }
    catch {
        res.status(401).json({
            success: false,
            message: 'Invalid or expired token.',
        });
        return;
    }
    if (typeof decoded.id !== 'string') {
        res.status(401).json({
            success: false,
            message: 'Invalid token payload.',
        });
        return;
    }
    const user = await User_1.User.findById(decoded.id).select('email role isActive');
    if (!user) {
        res.status(401).json({
            success: false,
            message: 'User no longer exists.',
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
    // A user with a missing/legacy/invalid role gets no access at all.
    if (!User_1.USER_ROLES.includes(user.role)) {
        res.status(403).json({
            success: false,
            message: 'Your account does not have a valid role assigned.',
        });
        return;
    }
    req.user = {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
    };
    next();
};
exports.protect = protect;
/** 401 if somehow used without `protect`, 403 when the role is not permitted. */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Not authenticated.',
            });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                message: 'You do not have permission to perform this action.',
            });
            return;
        }
        next();
    };
}
/** Admin-only guard (user management, security-sensitive operations). */
exports.requireAdmin = requireRole('admin');
/**
 * Role-based CMS permission guard, e.g. `requirePermission('delete')`.
 * Must run after `protect`.
 */
function requirePermission(permission) {
    const allowed = exports.CMS_PERMISSIONS[permission] ?? [];
    return requireRole(...allowed);
}
