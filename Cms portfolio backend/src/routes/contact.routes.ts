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
router.put("/info", updateInfo);

// FAQs — protected
router.post("/faq", createFAQ);
router.put("/faq/:id", updateFAQ);
router.delete("/faq/:id", deleteFAQ);

export default router;
