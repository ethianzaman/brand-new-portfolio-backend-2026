import { Router } from "express";
import {
  getServices,
  getServiceStats,
  getServiceBySlug,
  createService,
  updateService,
  deleteService,
} from "../controllers/service.controller";
import { protect, requirePermission } from "../middleware/auth";

const router = Router();

router.get("", getServices);
router.get("/stats", getServiceStats);
router.get("/slug/:slug", getServiceBySlug);
router.post("/create", protect, requirePermission("create"), createService);
router.put("/:id", protect, requirePermission("update"), updateService);
router.delete("/:id", protect, requirePermission("delete"), deleteService);

export default router;
