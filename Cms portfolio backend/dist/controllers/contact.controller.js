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
const mongoose_1 = __importDefault(require("mongoose"));
const Contact_1 = require("../models/Contact");
const publish_1 = require("../lib/publish");
function serializeFAQ(faq) {
    const id = String(faq._id ?? faq.id);
    return {
        id,
        _id: id,
        question: faq.question,
        answer: faq.answer,
        order: faq.order,
    };
}
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
                    socials: {
                        github: "",
                        linkedin: "",
                        twitter: "",
                    },
                },
                faqs: [],
            });
        }
        const data = contact.toObject();
        res.status(200).json({
            success: true,
            contact: {
                ...data,
                faqs: contact.faqs.map(serializeFAQ),
            },
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: err instanceof Error ? err.message : "Server erroclerr",
        });
    }
}
async function updateInfo(req, res) {
    try {
        const contact = await Contact_1.Contact.findOneAndUpdate({}, { $set: { info: req.body } }, {
            new: true,
            upsert: true,
            runValidators: true,
        });
        if (!contact) {
            res.status(500).json({
                success: false,
                message: "Failed to update contact information.",
            });
            return;
        }
        await (0, publish_1.publishChange)("contact");
        res.status(200).json({
            success: true,
            info: contact.info,
        });
    }
    catch (err) {
        res.status(400).json({
            success: false,
            message: err instanceof Error ? err.message : "Failed to update contact.",
        });
    }
}
async function createFAQ(req, res) {
    try {
        const { question, answer } = req.body;
        if (typeof question !== "string" ||
            typeof answer !== "string" ||
            !question.trim() ||
            !answer.trim()) {
            res.status(400).json({
                success: false,
                message: "Question and answer are required.",
            });
            return;
        }
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
                    socials: {
                        github: "",
                        linkedin: "",
                        twitter: "",
                    },
                },
                faqs: [],
            });
        }
        const nextOrder = contact.faqs.length + 1;
        contact.faqs.push({
            question: question.trim(),
            answer: answer.trim(),
            order: nextOrder,
        });
        await contact.save();
        const createdFAQ = contact.faqs[contact.faqs.length - 1];
        await (0, publish_1.publishChange)("contact");
        res.status(201).json({
            success: true,
            faq: serializeFAQ(createdFAQ),
        });
    }
    catch (err) {
        res.status(400).json({
            success: false,
            message: err instanceof Error ? err.message : "Failed to create FAQ.",
        });
    }
}
async function updateFAQ(req, res) {
    try {
        const { id } = req.params;
        const { question, answer } = req.body;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid FAQ ID.",
            });
            return;
        }
        if ((question !== undefined &&
            (typeof question !== "string" || !question.trim())) ||
            (answer !== undefined &&
                (typeof answer !== "string" || !answer.trim()))) {
            res.status(400).json({
                success: false,
                message: "Question and answer must be non-empty strings.",
            });
            return;
        }
        if (question === undefined && answer === undefined) {
            res.status(400).json({
                success: false,
                message: "At least one field is required.",
            });
            return;
        }
        const updates = {};
        if (question !== undefined) {
            updates["faqs.$.question"] = question.trim();
        }
        if (answer !== undefined) {
            updates["faqs.$.answer"] = answer.trim();
        }
        const contact = await Contact_1.Contact.findOneAndUpdate({ "faqs._id": new mongoose_1.default.Types.ObjectId(id) }, { $set: updates }, {
            new: true,
            runValidators: true,
        });
        if (!contact) {
            res.status(404).json({
                success: false,
                message: "FAQ not found.",
            });
            return;
        }
        const updatedFAQ = contact.faqs.find((faq) => String(faq._id) === id);
        if (!updatedFAQ) {
            res.status(404).json({
                success: false,
                message: "Updated FAQ not found.",
            });
            return;
        }
        await (0, publish_1.publishChange)("contact");
        res.status(200).json({
            success: true,
            faq: serializeFAQ(updatedFAQ),
        });
    }
    catch (err) {
        res.status(400).json({
            success: false,
            message: err instanceof Error ? err.message : "Failed to update FAQ.",
        });
    }
}
async function deleteFAQ(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid FAQ ID.",
            });
            return;
        }
        const contact = await Contact_1.Contact.findOneAndUpdate({ "faqs._id": new mongoose_1.default.Types.ObjectId(id) }, {
            $pull: {
                faqs: {
                    _id: new mongoose_1.default.Types.ObjectId(id),
                },
            },
        }, { new: true });
        if (!contact) {
            res.status(404).json({
                success: false,
                message: "FAQ not found.",
            });
            return;
        }
        await (0, publish_1.publishChange)("contact");
        res.status(200).json({
            success: true,
            message: "FAQ deleted successfully.",
            id,
        });
    }
    catch (err) {
        res.status(400).json({
            success: false,
            message: err instanceof Error ? err.message : "Failed to delete FAQ.",
        });
    }
}
