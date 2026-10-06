"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const contact_controller_1 = require("../controllers/contact.controller");
const router = (0, express_1.Router)();
// Public
router.get("/", contact_controller_1.getContact);
// Info — protected
router.put("/info", contact_controller_1.updateInfo);
// FAQs — protected
router.post("/faq", contact_controller_1.createFAQ);
router.put("/faq/:id", contact_controller_1.updateFAQ);
router.delete("/faq/:id", contact_controller_1.deleteFAQ);
exports.default = router;
