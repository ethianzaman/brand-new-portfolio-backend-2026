"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settings_controller_1 = require("../controllers/settings.controller");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public — Navbar and Footer read the shared brand + socials from here
router.get("/", settings_controller_1.getSiteSettings);
// Public — static-page SEO overrides for the public resolver.
router.get("/pages/seo", settings_controller_1.getPageSeo);
// Brand settings are site content (not security-sensitive): Admin, Manager, Editor.
router.put("/brand", auth_1.protect, (0, auth_1.requirePermission)("update"), uploadMiddleware_1.upload.single("logo"), settings_controller_1.updateBrand);
// Socials — replace the shared social links list (JSON body)
router.put("/socials", auth_1.protect, (0, auth_1.requirePermission)("update"), settings_controller_1.updateSocials);
// Global SEO defaults — Admin, Manager, Editor (site content).
router.put("/seo", auth_1.protect, (0, auth_1.requirePermission)("update"), settings_controller_1.updateSeo);
// Static-page SEO overrides — Admin, Manager, Editor.
router.put("/pages/seo/:page", auth_1.protect, (0, auth_1.requirePermission)("update"), settings_controller_1.updatePageSeo);
exports.default = router;
