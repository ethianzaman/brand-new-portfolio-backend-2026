"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUserStatus = exports.updateUserRole = exports.createUser = exports.getUsers = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = require("../models/User");
// ── Helpers ─────────────────────────────────────────────────────────
function generateTempPassword() {
    // 12 chars, URL-safe, satisfies the 8-char minimum.
    return crypto_1.default.randomBytes(9).toString('base64url');
}
/** Number of active admins, optionally excluding one user. */
async function activeAdminCount(excludeId) {
    const filter = {
        role: 'admin',
        isActive: true,
    };
    if (excludeId)
        filter._id = { $ne: excludeId };
    return User_1.User.countDocuments(filter);
}
function isDuplicateKeyError(error) {
    return (typeof error === 'object' &&
        error !== null &&
        error.code === 11000);
}
/** Public shape — never includes the password hash. */
function serializeUser(user) {
    return {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
}
// ── GET /api/users — Admin only ─────────────────────────────────────
const getUsers = async (req, res) => {
    try {
        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        const filter = q
            ? { email: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
            : {};
        const users = await User_1.User.find(filter).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            users: users.map(serializeUser),
            total: users.length,
        });
    }
    catch {
        res.status(500).json({ success: false, message: 'Failed to load users.' });
    }
};
exports.getUsers = getUsers;
// ── POST /api/users — Admin only ────────────────────────────────────
const createUser = async (req, res) => {
    try {
        const email = String(req.body.email ?? '')
            .trim()
            .toLowerCase();
        const role = req.body.role;
        const providedPassword = typeof req.body.password === 'string' && req.body.password.length > 0
            ? req.body.password
            : null;
        if (!email) {
            res.status(400).json({ success: false, message: 'Email is required.' });
            return;
        }
        if (!User_1.USER_ROLES.includes(role)) {
            res.status(400).json({
                success: false,
                message: 'Role must be admin, manager or editor.',
            });
            return;
        }
        if (providedPassword !== null && providedPassword.length < 8) {
            res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters.',
            });
            return;
        }
        const existing = await User_1.User.findOne({ email });
        if (existing) {
            res.status(409).json({
                success: false,
                message: 'An account with this email already exists.',
            });
            return;
        }
        // If no password is supplied, generate a temporary one that is
        // returned exactly once so the admin can share it with the user.
        const temporaryPassword = providedPassword ?? generateTempPassword();
        const user = await User_1.User.create({
            email,
            password: temporaryPassword,
            role,
            isActive: true,
        });
        res.status(201).json({
            success: true,
            message: 'User created successfully.',
            user: serializeUser(user),
            ...(providedPassword ? {} : { temporaryPassword }),
        });
    }
    catch (error) {
        if (isDuplicateKeyError(error)) {
            res.status(409).json({
                success: false,
                message: 'An account with this email already exists.',
            });
            return;
        }
        res.status(500).json({ success: false, message: 'Failed to create user.' });
    }
};
exports.createUser = createUser;
// ── PATCH /api/users/:id/role — Admin only ──────────────────────────
const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const role = req.body.role;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ success: false, message: 'Invalid user ID.' });
            return;
        }
        if (!User_1.USER_ROLES.includes(role)) {
            res.status(400).json({
                success: false,
                message: 'Role must be admin, manager or editor.',
            });
            return;
        }
        const user = await User_1.User.findById(id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        // Never let the last active admin demote themselves (or be demoted).
        if (user.role === 'admin' &&
            user.isActive &&
            role !== 'admin' &&
            (await activeAdminCount(user._id.toString())) === 0) {
            res.status(400).json({
                success: false,
                message: 'Cannot change the role of the last active administrator.',
            });
            return;
        }
        user.role = role;
        await user.save();
        res.status(200).json({
            success: true,
            message: 'Role updated successfully.',
            user: serializeUser(user),
        });
    }
    catch {
        res.status(500).json({ success: false, message: 'Failed to update role.' });
    }
};
exports.updateUserRole = updateUserRole;
// ── PATCH /api/users/:id/status — Admin only ────────────────────────
const updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const isActive = req.body.isActive;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ success: false, message: 'Invalid user ID.' });
            return;
        }
        if (typeof isActive !== 'boolean') {
            res.status(400).json({
                success: false,
                message: 'isActive must be a boolean.',
            });
            return;
        }
        // Prevent an admin from locking themselves out.
        if (!isActive && id === req.user.id) {
            res.status(400).json({
                success: false,
                message: 'You cannot disable your own account.',
            });
            return;
        }
        const user = await User_1.User.findById(id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        if (!isActive &&
            user.role === 'admin' &&
            user.isActive &&
            (await activeAdminCount(user._id.toString())) === 0) {
            res.status(400).json({
                success: false,
                message: 'Cannot disable the last active administrator.',
            });
            return;
        }
        user.isActive = isActive;
        await user.save();
        res.status(200).json({
            success: true,
            message: isActive ? 'Account enabled.' : 'Account disabled.',
            user: serializeUser(user),
        });
    }
    catch {
        res
            .status(500)
            .json({ success: false, message: 'Failed to update account status.' });
    }
};
exports.updateUserStatus = updateUserStatus;
// ── DELETE /api/users/:id — Admin only ──────────────────────────────
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ success: false, message: 'Invalid user ID.' });
            return;
        }
        // An admin can never delete their own account through this API.
        if (id === req.user.id) {
            res.status(400).json({
                success: false,
                message: 'You cannot delete your own account.',
            });
            return;
        }
        const user = await User_1.User.findById(id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        if (user.role === 'admin' &&
            user.isActive &&
            (await activeAdminCount(user._id.toString())) === 0) {
            res.status(400).json({
                success: false,
                message: 'Cannot delete the last active administrator.',
            });
            return;
        }
        await user.deleteOne();
        res.status(200).json({
            success: true,
            message: 'User deleted.',
            id: user._id.toString(),
        });
    }
    catch {
        res.status(500).json({ success: false, message: 'Failed to delete user.' });
    }
};
exports.deleteUser = deleteUser;
