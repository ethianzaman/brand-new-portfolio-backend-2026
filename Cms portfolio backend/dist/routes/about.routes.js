"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const about_controller_1 = require("../controllers/about.controller");
const auth_1 = require("../middleware/auth");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const router = (0, express_1.Router)();
// Public
router.get("/", about_controller_1.getAbout);
// Hero — Admin, Manager, Editor
router.put("/hero", auth_1.protect, (0, auth_1.requirePermission)("update"), uploadMiddleware_1.upload.single("image"), about_controller_1.updateHero);
// Experiences
router.post("/experiences", auth_1.protect, (0, auth_1.requirePermission)("create"), about_controller_1.createExperience);
router.put("/experiences/:id", auth_1.protect, (0, auth_1.requirePermission)("update"), about_controller_1.updateExperience);
router.delete("/experiences/:id", auth_1.protect, (0, auth_1.requirePermission)("delete"), about_controller_1.deleteExperience);
// Educations
router.post("/educations", auth_1.protect, (0, auth_1.requirePermission)("create"), about_controller_1.createEducation);
router.put("/educations/:id", auth_1.protect, (0, auth_1.requirePermission)("update"), about_controller_1.updateEducation);
router.delete("/educations/:id", auth_1.protect, (0, auth_1.requirePermission)("delete"), about_controller_1.deleteEducation);
// Values
router.post("/values", auth_1.protect, (0, auth_1.requirePermission)("create"), about_controller_1.createValue);
router.put("/values/:id", auth_1.protect, (0, auth_1.requirePermission)("update"), about_controller_1.updateValue);
router.delete("/values/:id", auth_1.protect, (0, auth_1.requirePermission)("delete"), about_controller_1.deleteValue);
exports.default = router;
