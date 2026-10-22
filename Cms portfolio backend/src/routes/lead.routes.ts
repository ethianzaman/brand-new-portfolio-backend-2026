import { Router } from "express";
import {
  deleteLead,
  getLead,
  getLeads,
  markLeadRead,
} from "../controllers/lead.controller";
import { protect, requirePermission } from "../middleware/auth";

const router = Router();

// ── Dashboard — people behind the inbox ─────────────────────────────
// These routes were previously completely unauthenticated (any anonymous
// visitor could list/read/delete leads and private message timelines).
// Reads + mark-read: any authenticated role.  Delete: Admin, Manager only.
router.get("/", protect, getLeads);
router.get("/:id", protect, getLead);
router.post("/:id/read", protect, markLeadRead);
router.delete("/:id", protect, requirePermission("delete"), deleteLead);

export default router;
