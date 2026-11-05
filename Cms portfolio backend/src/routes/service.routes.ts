import { publicCache } from "../middleware/publicCache";
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

router.get("", publicCache("services"), getServices);
router.get("/stats", protect, requirePermission("services.view"), getServiceStats);
router.get("/slug/:slug", publicCache("services"), getServiceBySlug);
router.post("/create", protect, requirePermission("services.create"), createService);
router.put("/:id", protect, requirePermission("services.edit"), updateService);
router.delete("/:id", protect, requirePermission("services.delete"), deleteService);

export default router;
