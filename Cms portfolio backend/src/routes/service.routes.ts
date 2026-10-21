import { Router } from "express";
import {
  getServices,
  createService,
  updateService,
  deleteService,
} from "../controllers/service.controller";
import { protect } from "../middleware/auth";

const router = Router();

router.get("", getServices);
router.post("/create", protect, createService);
router.put("/:id", protect, updateService);
router.delete("/:id", protect, deleteService);

export default router;
