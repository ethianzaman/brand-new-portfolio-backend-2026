"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const home_controller_1 = require("../controllers/home.controller");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const router = (0, express_1.Router)();
// ── Public (fast, cached) ────────────────────────────────────────
router.get("/", home_controller_1.getHome);
// ── Hero — protected (FormData: image + resume files) ────────────
// router.put("/hero", protect, upload.fields([...]), updateHero)
router.put("/hero", uploadMiddleware_1.upload.fields([
    { name: "image", maxCount: 1 },
    { name: "resume", maxCount: 1 },
]), home_controller_1.updateHero);
// ── Stats — protected ────────────────────────────────────────────
router.put("/stats", home_controller_1.replaceStats); // frontend contract: পুরো array replace
router.post("/stats", home_controller_1.createStat);
router.put("/stats/:id", home_controller_1.updateStat);
router.delete("/stats/:id", home_controller_1.deleteStat);
// ── Socials — protected ──────────────────────────────────────────
router.post("/socials", home_controller_1.createSocial);
router.put("/socials/:id", home_controller_1.updateSocial);
router.delete("/socials/:id", home_controller_1.deleteSocial);
exports.default = router;
