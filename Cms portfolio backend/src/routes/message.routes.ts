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

const router = Router();

// ── Public — contact form submission ────────────────────────────────
router.post("/", createMessage);

// ── Dashboard — inbox management ────────────────────────────────────
// Static segments MUST be registered before "/:id".
router.get("/unread-count", getUnreadCount);
router.post("/read-all", markAllRead);

router.get("/", getMessages);
router.get("/:id", getMessage);
router.patch("/:id", updateMessage);
router.post("/:id/reply", replyToMessage);
router.delete("/:id", deleteMessage);

export default router;
