import { Router } from "express";
import {
  createMessage,
  deleteMessage,
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
router.post("/", createMessage);

// ── Dashboard — inbox management ────────────────────────────────────
// Static segments MUST be registered before "/:id".
// Reading and replying: any authenticated role (Admin, Manager, Editor).
// Deleting: Admin, Manager only.
router.get("/unread-count", protect, getUnreadCount);
router.post("/read-all", protect, markAllRead);

router.get("/", protect, getMessages);
router.get("/:id", protect, getMessage);
router.patch("/:id", protect, updateMessage);
router.post("/:id/reply", protect, replyToMessage);
router.delete("/:id", protect, requirePermission("delete"), deleteMessage);

export default router;
