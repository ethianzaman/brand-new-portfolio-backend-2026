"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settings_controller_1 = require("../controllers/settings.controller");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const router = (0, express_1.Router)();
// Public — Navbar and Footer read the shared brand from here
router.get("/", settings_controller_1.getSiteSettings);
// Brand — name + logo/icon (FormData: optional `logo` file)
router.put("/brand", uploadMiddleware_1.upload.single("logo"), settings_controller_1.updateBrand);
exports.default = router;
