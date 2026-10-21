"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const home_controller_1 = require("../controllers/home.controller");
const auth_1 = require("../middleware/auth");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const router = (0, express_1.Router)();
// ── Public (fast, cached) ────────────────────────────────────────
router.get("/", home_controller_1.getHome);
// ── Hero — Admin, Manager, Editor (FormData: image + resume files) ──
router.put("/hero", auth_1.protect, (0, auth_1.requirePermission)("update"), uploadMiddleware_1.upload.fields([
    { name: "image", maxCount: 1 },
    { name: "resume", maxCount: 1 },
]), home_controller_1.updateHero);
// ── Stats ────────────────────────────────────────────────────────
router.put("/stats", auth_1.protect, (0, auth_1.requirePermission)("update"), home_controller_1.replaceStats); // frontend contract: replace whole array
router.post("/stats", auth_1.protect, (0, auth_1.requirePermission)("create"), home_controller_1.createStat);
router.put("/stats/:id", auth_1.protect, (0, auth_1.requirePermission)("update"), home_controller_1.updateStat);
router.delete("/stats/:id", auth_1.protect, (0, auth_1.requirePermission)("delete"), home_controller_1.deleteStat);
// ── Socials ──────────────────────────────────────────────────────
router.post("/socials", auth_1.protect, (0, auth_1.requirePermission)("create"), home_controller_1.createSocial);
router.put("/socials/:id", auth_1.protect, (0, auth_1.requirePermission)("update"), home_controller_1.updateSocial);
router.delete("/socials/:id", auth_1.protect, (0, auth_1.requirePermission)("delete"), home_controller_1.deleteSocial);
exports.default = router;
