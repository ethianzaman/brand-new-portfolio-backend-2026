"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public registration is disabled — kept only for a clear 403 response.
router.post('/sign-up', auth_controller_1.signUp);
router.post('/login', auth_controller_1.login);
router.post('/logout', auth_controller_1.logout);
// Current authenticated user (role + status read fresh from the DB).
router.get('/me', auth_1.protect, auth_controller_1.getMe);
exports.default = router;
