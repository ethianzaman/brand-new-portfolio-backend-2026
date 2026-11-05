import { publicCache } from "../middleware/publicCache";
import { Router } from "express";
import {
  getContact,
  updateInfo,
  updateFormOptions,
  createFAQ,
  updateFAQ,
  deleteFAQ,
} from "../controllers/contact.controller";
import { protect, requirePermission } from "../middleware/auth";

const router = Router();

// Public
router.get("/", publicCache("contact"), getContact);

// Info — Admin, Manager, Editor
router.put("/info", protect, requirePermission("contact.edit"), updateInfo);
router.put(
  "/form-options",
  protect,
  requirePermission("contact.edit"),
  updateFormOptions,
);

// FAQs
router.post("/faq", protect, requirePermission("contact.create"), createFAQ);
router.put("/faq/:id", protect, requirePermission("contact.edit"), updateFAQ);
router.delete("/faq/:id", protect, requirePermission("contact.delete"), deleteFAQ);

export default router;
