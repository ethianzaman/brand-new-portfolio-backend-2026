"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const user_controller_1 = require("../controllers/user.controller");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const User_1 = require("../models/User");
const router = (0, express_1.Router)();
// Every user-management route requires authentication + the admin role.
router.use(auth_1.protect, auth_1.requireAdmin);
// GET /api/users — list users (q = optional email search)
router.get('/', user_controller_1.getUsers);
// POST /api/users — create an account and assign a role
router.post('/', (0, validate_1.validate)([
    (0, express_validator_1.body)('email')
        .trim()
        .isEmail()
        .withMessage('A valid email address is required.'),
    (0, express_validator_1.body)('password')
        .optional({ values: 'falsy' })
        .isString()
        .isLength({ min: 8, max: 128 })
        .withMessage('Password must be 8-128 characters.'),
    (0, express_validator_1.body)('role')
        .isIn(User_1.USER_ROLES)
        .withMessage('Role must be admin, manager or editor.'),
]), user_controller_1.createUser);
// PATCH /api/users/:id/role — change a user's role
router.patch('/:id/role', (0, validate_1.validate)([
    (0, express_validator_1.param)('id').isMongoId().withMessage('Invalid user ID.'),
    (0, express_validator_1.body)('role').isIn(User_1.USER_ROLES).withMessage('Invalid role.'),
]), user_controller_1.updateUserRole);
// PATCH /api/users/:id/status — enable / disable an account
router.patch('/:id/status', (0, validate_1.validate)([
    (0, express_validator_1.param)('id').isMongoId().withMessage('Invalid user ID.'),
    (0, express_validator_1.body)('isActive').isBoolean().withMessage('isActive must be a boolean.'),
]), user_controller_1.updateUserStatus);
// DELETE /api/users/:id — delete a user (last-admin / self guards apply)
router.delete('/:id', (0, validate_1.validate)([(0, express_validator_1.param)('id').isMongoId().withMessage('Invalid user ID.')]), user_controller_1.deleteUser);
exports.default = router;
