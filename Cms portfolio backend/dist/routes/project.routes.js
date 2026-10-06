"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const project_controller_1 = require("../controllers/project.controller");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const router = (0, express_1.Router)();
// Public
router.get("/", project_controller_1.getProjects);
router.get("/all", project_controller_1.getAllProjects);
router.get("/:id", project_controller_1.getProjectById);
// Protected — dashboard only
// router.post("/", createProject);
router.post("/create", uploadMiddleware_1.upload.single("image"), project_controller_1.createProject);
// router.put("/:id", updateProject);
router.put("/:id", uploadMiddleware_1.upload.single("image"), project_controller_1.updateProject);
router.delete("/:id", project_controller_1.deleteProject);
exports.default = router;
