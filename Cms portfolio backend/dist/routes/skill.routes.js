"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const skill_controller_1 = require("../controllers/skill.controller");
const auth_1 = require("../middleware/auth");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const router = (0, express_1.Router)();
// Public
router.get("/", skill_controller_1.getSkills);
// Category CRUD — create/update: Admin, Manager, Editor.  Delete: Admin, Manager.
router.post("/categories", auth_1.protect, (0, auth_1.requirePermission)("create"), skill_controller_1.createCategory);
router.put("/categories/:id", auth_1.protect, (0, auth_1.requirePermission)("update"), skill_controller_1.updateCategory);
router.delete("/categories/:id", auth_1.protect, (0, auth_1.requirePermission)("delete"), skill_controller_1.deleteCategory);
// Skill CRUD inside category — same permission policy as categories
router.post("/categories/:id/skills", auth_1.protect, (0, auth_1.requirePermission)("create"), uploadMiddleware_1.upload.single("icon"), skill_controller_1.addSkill);
router.put("/categories/:id/skills/:skillName", auth_1.protect, (0, auth_1.requirePermission)("update"), uploadMiddleware_1.upload.single("icon"), skill_controller_1.updateSkill);
router.delete("/categories/:id/skills/:skillName", auth_1.protect, (0, auth_1.requirePermission)("delete"), skill_controller_1.deleteSkill);
exports.default = router;
