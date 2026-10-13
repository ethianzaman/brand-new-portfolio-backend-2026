"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const about_controller_1 = require("../controllers/about.controller");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const router = (0, express_1.Router)();
// Public
router.get("/", about_controller_1.getAbout);
// Hero — protected
// router.put('/hero', protect, updateHero)
router.put("/hero", uploadMiddleware_1.upload.single("image"), about_controller_1.updateHero);
// Experiences — protected
router.post("/experiences", about_controller_1.createExperience);
router.put("/experiences/:id", about_controller_1.updateExperience);
router.delete("/experiences/:id", about_controller_1.deleteExperience);
// Educations — protected
router.post("/educations", about_controller_1.createEducation);
router.put("/educations/:id", about_controller_1.updateEducation);
router.delete("/educations/:id", about_controller_1.deleteEducation);
// Values — protected
router.post("/values", about_controller_1.createValue);
router.put("/values/:id", about_controller_1.updateValue);
router.delete("/values/:id", about_controller_1.deleteValue);
exports.default = router;
