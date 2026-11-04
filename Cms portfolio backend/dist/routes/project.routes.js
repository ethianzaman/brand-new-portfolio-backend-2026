"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const project_controller_1 = require("../controllers/project.controller");
const auth_1 = require("../middleware/auth");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const router = (0, express_1.Router)();
// Public
router.get("/", project_controller_1.getProjects);
// NOTE: static segments must be registered BEFORE "/:id", otherwise
// "/all" is matched as an id and Project.findById("all") throws a CastError
// (HTTP 500).
router.get("/all", project_controller_1.getAllProjects);
router.get("/stats", project_controller_1.getProjectStats);
router.get("/slug/:slug", project_controller_1.getProjectBySlug);
router.get("/:id", project_controller_1.getProjectById);
// Protected — dashboard only
// Create/update: Admin, Manager, Editor.  Delete: Admin, Manager.
router.post("/create", auth_1.protect, (0, auth_1.requirePermission)("create"), uploadMiddleware_1.upload.single("image"), project_controller_1.createProject);
router.put("/:id", auth_1.protect, (0, auth_1.requirePermission)("update"), uploadMiddleware_1.upload.single("image"), project_controller_1.updateProject);
router.delete("/:id", auth_1.protect, (0, auth_1.requirePermission)("delete"), project_controller_1.deleteProject);
exports.default = router;
