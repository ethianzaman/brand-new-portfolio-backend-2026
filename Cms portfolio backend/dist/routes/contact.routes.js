"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const contact_controller_1 = require("../controllers/contact.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public
router.get("/", contact_controller_1.getContact);
// Info — Admin, Manager, Editor
router.put("/info", auth_1.protect, (0, auth_1.requirePermission)("update"), contact_controller_1.updateInfo);
// FAQs
router.post("/faq", auth_1.protect, (0, auth_1.requirePermission)("create"), contact_controller_1.createFAQ);
router.put("/faq/:id", auth_1.protect, (0, auth_1.requirePermission)("update"), contact_controller_1.updateFAQ);
router.delete("/faq/:id", auth_1.protect, (0, auth_1.requirePermission)("delete"), contact_controller_1.deleteFAQ);
exports.default = router;
