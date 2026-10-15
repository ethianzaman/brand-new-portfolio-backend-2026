import { Router } from "express";
import {
  deleteLead,
  getLead,
  getLeads,
  markLeadRead,
} from "../controllers/lead.controller";

const router = Router();

// ── Dashboard — people behind the inbox ─────────────────────────────
router.get("/", getLeads);
router.get("/:id", getLead);
router.post("/:id/read", markLeadRead);
router.delete("/:id", deleteLead);

export default router;
