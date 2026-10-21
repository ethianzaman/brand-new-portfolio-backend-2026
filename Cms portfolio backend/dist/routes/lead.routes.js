"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const lead_controller_1 = require("../controllers/lead.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// ── Dashboard — people behind the inbox ─────────────────────────────
// These routes were previously completely unauthenticated (any anonymous
// visitor could list/read/delete leads and private message timelines).
// Reads + mark-read: any authenticated role.  Delete: Admin, Manager only.
router.get("/", auth_1.protect, lead_controller_1.getLeads);
router.get("/:id", auth_1.protect, lead_controller_1.getLead);
router.post("/:id/read", auth_1.protect, lead_controller_1.markLeadRead);
router.delete("/:id", auth_1.protect, (0, auth_1.requirePermission)("delete"), lead_controller_1.deleteLead);
exports.default = router;
