import { Router } from "express";
import {
  getContact,
  updateInfo,
  createFAQ,
  updateFAQ,
  deleteFAQ,
} from "../controllers/contact.controller";
import { protect, requirePermission } from "../middleware/auth";

const router = Router();

// Public
router.get("/", getContact);

// Info — Admin, Manager, Editor
router.put("/info", protect, requirePermission("update"), updateInfo);

// FAQs
router.post("/faq", protect, requirePermission("create"), createFAQ);
router.put("/faq/:id", protect, requirePermission("update"), updateFAQ);
router.delete("/faq/:id", protect, requirePermission("delete"), deleteFAQ);

export default router;
