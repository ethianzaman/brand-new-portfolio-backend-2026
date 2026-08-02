import { Router } from "express";
import {
  getContact,
  updateInfo,
  createFAQ,
  updateFAQ,
  deleteFAQ,
} from "../controllers/contact.controller";
import { protect } from "../middleware/auth";

const router = Router();

// Public
router.get("/", getContact);

// Info — protected
router.put("/info", protect, updateInfo);

// FAQs — protected
router.post("/faq", protect, createFAQ);
router.put("/faq/:id", protect, updateFAQ);
router.delete("/faq/:id", protect, deleteFAQ);

export default router;
