"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const message_controller_1 = require("../controllers/message.controller");
const router = (0, express_1.Router)();
// ── Public — contact form submission ────────────────────────────────
router.post("/", message_controller_1.createMessage);
// ── Dashboard — inbox management ────────────────────────────────────
// Static segments MUST be registered before "/:id".
router.get("/unread-count", message_controller_1.getUnreadCount);
router.post("/read-all", message_controller_1.markAllRead);
router.get("/", message_controller_1.getMessages);
router.get("/:id", message_controller_1.getMessage);
router.patch("/:id", message_controller_1.updateMessage);
router.post("/:id/reply", message_controller_1.replyToMessage);
router.delete("/:id", message_controller_1.deleteMessage);
exports.default = router;
