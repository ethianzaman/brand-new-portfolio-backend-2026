"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const lead_controller_1 = require("../controllers/lead.controller");
const router = (0, express_1.Router)();
// ── Dashboard — people behind the inbox ─────────────────────────────
router.get("/", lead_controller_1.getLeads);
router.get("/:id", lead_controller_1.getLead);
router.post("/:id/read", lead_controller_1.markLeadRead);
router.delete("/:id", lead_controller_1.deleteLead);
exports.default = router;
