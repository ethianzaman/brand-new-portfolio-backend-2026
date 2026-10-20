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
import { protect } from "../middleware/auth";
import { upload } from "../middleware/uploadMiddleware";

const router = Router();

// ── Public (fast, cached) ────────────────────────────────────────
router.get("/", getHome);

// ── Hero — protected (FormData: image + resume files) ────────────
// router.put("/hero", protect, upload.fields([...]), updateHero)
router.put(
  "/hero", protect,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "resume", maxCount: 1 },
  ]),
  updateHero,
);

// ── Stats — protected ────────────────────────────────────────────
router.put("/stats", protect, replaceStats); // frontend contract: পুরো array replace
router.post("/stats", protect, createStat);
router.put("/stats/:id", protect, updateStat);
router.delete("/stats/:id", protect, deleteStat);

// ── Socials — protected ──────────────────────────────────────────
router.post("/socials", protect, createSocial);
router.put("/socials/:id", protect, updateSocial);
router.delete("/socials/:id", protect, deleteSocial);

export default router;