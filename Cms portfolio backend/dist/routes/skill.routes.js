"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const skill_controller_1 = require("../controllers/skill.controller");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const router = (0, express_1.Router)();
// Public
router.get("/", skill_controller_1.getSkills);
// Category CRUD — protected
router.post("/categories", skill_controller_1.createCategory);
router.put("/categories/:id", skill_controller_1.updateCategory);
router.delete("/categories/:id", skill_controller_1.deleteCategory);
// Skill CRUD inside category — protected
// router.post("/categories/:id/skills", addSkill);
router.post("/categories/:id/skills", uploadMiddleware_1.upload.single("icon"), skill_controller_1.addSkill);
router.put("/categories/:id/skills/:skillName", uploadMiddleware_1.upload.single("icon"), skill_controller_1.updateSkill);
router.delete("/categories/:id/skills/:skillName", skill_controller_1.deleteSkill);
exports.default = router;
