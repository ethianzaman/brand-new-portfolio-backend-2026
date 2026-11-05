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
router.get("/", protect, requirePermission("messages.view"), getLeads);
router.get("/:id", protect, requirePermission("messages.view"), getLead);
router.post("/:id/read", protect, requirePermission("messages.edit"), markLeadRead);
router.delete("/:id", protect, requirePermission("messages.delete"), deleteLead);

export default router;
