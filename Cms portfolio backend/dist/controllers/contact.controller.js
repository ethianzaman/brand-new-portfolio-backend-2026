"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContact = getContact;
exports.updateInfo = updateInfo;
exports.createFAQ = createFAQ;
exports.updateFAQ = updateFAQ;
exports.deleteFAQ = deleteFAQ;
const Contact_1 = require("../models/Contact");
const mongoose_1 = __importDefault(require("mongoose"));
async function getContact(req, res) {
    try {
        let contact = await Contact_1.Contact.findOne();
        if (!contact) {
            contact = await Contact_1.Contact.create({
                info: {
                    email: "you@example.com",
                    phone: "",
                    location: "",
                    responseTime: "Within 24 hours",
                    available: true,
                    availableText: "Currently accepting work",
                    socials: { github: "", linkedin: "", twitter: "" },
                },
                faqs: [],
            });
        }
        res.status(200).json({ success: true, contact });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
async function updateInfo(req, res) {
    try {
        const contact = await Contact_1.Contact.findOneAndUpdate({}, { $set: { info: req.body } }, { new: true, upsert: true });
        res.status(200).json({ success: true, info: contact.info });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
}
async function createFAQ(req, res) {
    try {
        const count = await Contact_1.Contact.findOne().then((c) => c?.faqs.length ?? 0);
        const faq = { ...req.body, id: `faq-${Date.now()}`, order: count + 1 };
        const contact = await Contact_1.Contact.findOneAndUpdate({}, { $push: { faqs: faq } }, { new: true, upsert: true });
        res.status(201).json({ success: true, faq });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
}
async function updateFAQ(req, res) {
    try {
        const faqId = new mongoose_1.default.Types.ObjectId(req.params.id);
        const contact = await Contact_1.Contact.findOneAndUpdate({
            "faqs._id": faqId,
        }, {
            $set: {
                "faqs.$.question": req.body.question,
                "faqs.$.answer": req.body.answer,
            },
        }, {
            new: true,
        });
        if (!contact) {
            res.status(404).json({
                success: false,
                message: "FAQ not found",
            });
            return;
        }
        const updated = contact.faqs.find((faq) => faq._id.toString() === req.params.id);
        res.status(200).json({
            success: true,
            faq: updated,
        });
    }
    catch (err) {
        res.status(400).json({
            success: false,
            message: err.message,
        });
    }
}
async function deleteFAQ(req, res) {
    try {
        const contact = await Contact_1.Contact.findOneAndUpdate({}, {
            $pull: {
                faqs: {
                    _id: new mongoose_1.default.Types.ObjectId(req.params.id),
                },
            },
        }, { new: true });
        if (!contact) {
            res.status(404).json({
                success: false,
                message: "Contact not found",
            });
            return;
        }
        res.status(200).json({
            success: true,
            message: "FAQ deleted",
        });
    }
    catch (err) {
        res.status(400).json({
            success: false,
            message: err.message,
        });
    }
}
