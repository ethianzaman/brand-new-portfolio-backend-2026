"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_copy_1 = require("../controllers/auth.controller copy");
const router = (0, express_1.Router)();
router.post('/sign-up', auth_controller_copy_1.signUp);
router.post('/login', auth_controller_copy_1.login);
exports.default = router;
