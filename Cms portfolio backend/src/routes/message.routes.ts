import { contactLimiter } from "../middleware/rateLimit";
import { Router } from "express";
import {
  createMessage,
  deleteMessage,
  getInboxStats,
  getMessage,
  getMessages,
  getUnreadCount,
  markAllRead,
  replyToMessage,
  updateMessage,
} from "../controllers/message.controller";
import { protect, requirePermission } from "../middleware/auth";

const router = Router();

// ── Public — contact form submission ────────────────────────────────
router.post("/", contactLimiter, createMessage);

// ── Dashboard — inbox management ────────────────────────────────────
// Static segments MUST be registered before "/:id".
// Reading and replying: any authenticated role (Admin, Manager, Editor).
// Deleting: Admin, Manager only.
router.get("/unread-count", protect, requirePermission("messages.view"), getUnreadCount);
router.get("/stats", protect, requirePermission("messages.view"), getInboxStats);
router.post("/read-all", protect, requirePermission("messages.edit"), markAllRead);

router.get("/", protect, requirePermission("messages.view"), getMessages);
router.get("/:id", protect, requirePermission("messages.view"), getMessage);
router.patch("/:id", protect, requirePermission("messages.edit"), updateMessage);
router.post("/:id/reply", protect, requirePermission("messages.edit"), replyToMessage);
router.delete("/:id", protect, requirePermission("messages.delete"), deleteMessage);

export default router;
