"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLeads = getLeads;
exports.getLead = getLead;
exports.markLeadRead = markLeadRead;
exports.deleteLead = deleteLead;
const mongoose_1 = __importDefault(require("mongoose"));
const Lead_1 = require("../models/Lead");
const Message_1 = require("../models/Message");
const sse_1 = require("../lib/sse");
const message_controller_1 = require("./message.controller");
/**
 * ─────────────────────────────────────────────────────────────────────────
 *  Lead controller — the people behind the inbox.
 *
 *  The dashboard groups messages by person (a Lead), keyed on the normalized
 *  email address. This is separate from the Contact document (contact page
 *  info + FAQ): different model, different collection ("leads").
 *
 *    GET    /api/leads            list people (filter + search)
 *    GET    /api/leads/:id        a person + their full message timeline
 *    POST   /api/leads/:id/read   mark all of that person's messages read
 *    DELETE /api/leads/:id        delete a person and all their messages
 * ─────────────────────────────────────────────────────────────────────────
 */
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// ── Dashboard — list people ────────────────────────────────────────────────
async function getLeads(req, res) {
    try {
        const status = typeof req.query.status === "string" ? req.query.status : "";
        const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
        const starred = req.query.starred === "true";
        const limitRaw = parseInt(String(req.query.limit ?? "200"), 10);
        const limit = Number.isFinite(limitRaw)
            ? Math.min(Math.max(limitRaw, 1), 500)
            : 200;
        const filter = {};
        if (status === "unread")
            filter.unreadCount = { $gt: 0 };
        if (status === "read")
            filter.unreadCount = { $lte: 0 };
        if (starred) {
            const ids = await Message_1.Message.distinct("lead", { starred: true });
            filter._id = { $in: ids.filter(Boolean) };
        }
        if (q) {
            const rx = new RegExp(escapeRegExp(q), "i");
            const fromMessages = await Message_1.Message.distinct("lead", { body: rx });
            filter.$or = [
                { name: rx },
                { email: rx },
                { _id: { $in: fromMessages.filter(Boolean) } },
            ];
        }
        const [leads, total, unread] = await Promise.all([
            Lead_1.Lead.find(filter).sort({ lastMessageAt: -1 }).limit(limit),
            Lead_1.Lead.countDocuments(filter),
            Message_1.Message.countDocuments({ status: "unread" }),
        ]);
        // One preview (latest message) per listed person, plus a flag for people
        // who have starred at least one of their messages.
        const ids = leads.map((l) => l._id);
        const previewByLead = new Map();
        const starredLeads = new Set();
        if (ids.length > 0) {
            const recent = await Message_1.Message.find({ lead: { $in: ids } })
                .sort({ createdAt: -1 })
                .lean();
            for (const m of recent) {
                const key = String(m.lead);
                if (!previewByLead.has(key))
                    previewByLead.set(key, m);
                if (m.starred)
                    starredLeads.add(key);
            }
        }
        res.status(200).json({
            success: true,
            leads: leads.map((l) => {
                const preview = previewByLead.get(String(l._id));
                return {
                    ...(0, message_controller_1.serializeLead)(l),
                    hasStarred: starredLeads.has(String(l._id)),
                    preview: preview
                        ? {
                            subject: preview.subject,
                            body: preview.body,
                            status: preview.status,
                            starred: Boolean(preview.starred),
                            at: preview.createdAt,
                        }
                        : null,
                };
            }),
            total,
            unread,
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: err instanceof Error ? err.message : "Server error",
        });
    }
}
// ── Dashboard — one person + timeline ──────────────────────────────────────
async function getLead(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ success: false, message: "Invalid lead ID." });
            return;
        }
        const lead = await Lead_1.Lead.findById(id);
        if (!lead) {
            res.status(404).json({ success: false, message: "Lead not found." });
            return;
        }
        const messages = await Message_1.Message.find({ lead: id }).sort({ createdAt: 1 });
        res.status(200).json({
            success: true,
            lead: (0, message_controller_1.serializeLead)(lead),
            messages: messages.map(message_controller_1.serializeMessage),
        });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
// ── Dashboard — mark a person's messages read ──────────────────────────────
async function markLeadRead(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ success: false, message: "Invalid lead ID." });
            return;
        }
        const lead = await Lead_1.Lead.findByIdAndUpdate(id, { $set: { unreadCount: 0 } }, { new: true });
        if (!lead) {
            res.status(404).json({ success: false, message: "Lead not found." });
            return;
        }
        await Message_1.Message.updateMany({ lead: id, status: "unread" }, { $set: { status: "read" } });
        (0, sse_1.broadcast)("message:update", { leadId: id, at: Date.now() });
        res.status(200).json({ success: true, lead: (0, message_controller_1.serializeLead)(lead) });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
// ── Dashboard — delete a person (and their messages) ───────────────────────
async function deleteLead(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ success: false, message: "Invalid lead ID." });
            return;
        }
        const lead = await Lead_1.Lead.findByIdAndDelete(id);
        if (!lead) {
            res.status(404).json({ success: false, message: "Lead not found." });
            return;
        }
        await Message_1.Message.deleteMany({ lead: id });
        (0, sse_1.broadcast)("message:update", { leadId: id, at: Date.now() });
        res.status(200).json({ success: true, message: "Lead deleted.", id });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
