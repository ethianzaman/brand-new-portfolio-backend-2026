import { Router } from "express";
import {
  getHero,
  updateHero,
  replaceStats,
  createStat,
  updateStat,
  deleteStat,
} from "../controllers/hero.controller";
import { protect, requirePermission } from "../middleware/auth";
import { upload } from "../middleware/uploadMiddleware";

const router = Router();

// ── Public (fast, cached) ────────────────────────────────────────
router.get("/", getHero);

// ── Hero — Admin, Manager, Editor (FormData: image + resume files) ──
router.put(
  "/",
  protect,
  requirePermission("hero.edit"),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "resume", maxCount: 1 },
  ]),
  updateHero
);

// ── Stats ────────────────────────────────────────────────────────
router.put("/stats", protect, requirePermission("hero.edit"), replaceStats); // frontend contract: replace whole array
router.post("/stats", protect, requirePermission("hero.create"), createStat);
router.put("/stats/:id", protect, requirePermission("hero.edit"), updateStat);
router.delete("/stats/:id", protect, requirePermission("hero.delete"), deleteStat);

export default router;
