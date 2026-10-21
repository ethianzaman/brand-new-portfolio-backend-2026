"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const message_controller_1 = require("../controllers/message.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// ── Public — contact form submission ────────────────────────────────
router.post("/", message_controller_1.createMessage);
// ── Dashboard — inbox management ────────────────────────────────────
// Static segments MUST be registered before "/:id".
// Reading and replying: any authenticated role (Admin, Manager, Editor).
// Deleting: Admin, Manager only.
router.get("/unread-count", auth_1.protect, message_controller_1.getUnreadCount);
router.post("/read-all", auth_1.protect, message_controller_1.markAllRead);
router.get("/", auth_1.protect, message_controller_1.getMessages);
router.get("/:id", auth_1.protect, message_controller_1.getMessage);
router.patch("/:id", auth_1.protect, message_controller_1.updateMessage);
router.post("/:id/reply", auth_1.protect, message_controller_1.replyToMessage);
router.delete("/:id", auth_1.protect, (0, auth_1.requirePermission)("delete"), message_controller_1.deleteMessage);
exports.default = router;
