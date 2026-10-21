import { Router } from "express";
import {
  getHome,
  updateHero,
  replaceStats,
  createStat,
  updateStat,
  deleteStat,
  createSocial,
  updateSocial,
  deleteSocial,
} from "../controllers/home.controller";
import { protect, requirePermission } from "../middleware/auth";
import { upload } from "../middleware/uploadMiddleware";

const router = Router();

// ── Public (fast, cached) ────────────────────────────────────────
router.get("/", getHome);

// ── Hero — Admin, Manager, Editor (FormData: image + resume files) ──
router.put(
  "/hero",
  protect,
  requirePermission("update"),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "resume", maxCount: 1 },
  ]),
  updateHero
);

// ── Stats ────────────────────────────────────────────────────────
router.put("/stats", protect, requirePermission("update"), replaceStats); // frontend contract: replace whole array
router.post("/stats", protect, requirePermission("create"), createStat);
router.put("/stats/:id", protect, requirePermission("update"), updateStat);
router.delete("/stats/:id", protect, requirePermission("delete"), deleteStat);

// ── Socials ──────────────────────────────────────────────────────
router.post("/socials", protect, requirePermission("create"), createSocial);
router.put("/socials/:id", protect, requirePermission("update"), updateSocial);
router.delete(
  "/socials/:id",
  protect,
  requirePermission("delete"),
  deleteSocial
);

export default router;
