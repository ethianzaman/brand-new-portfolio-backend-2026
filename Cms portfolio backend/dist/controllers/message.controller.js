"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeMessage = serializeMessage;
exports.serializeLead = serializeLead;
exports.createMessage = createMessage;
exports.getMessages = getMessages;
exports.getUnreadCount = getUnreadCount;
exports.getMessage = getMessage;
exports.updateMessage = updateMessage;
exports.replyToMessage = replyToMessage;
exports.markAllRead = markAllRead;
exports.deleteMessage = deleteMessage;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const Message_1 = require("../models/Message");
const Lead_1 = require("../models/Lead");
const sse_1 = require("../lib/sse");
const mailer_1 = require("../lib/mailer");
/**
 * ─────────────────────────────────────────────────────────────────────────
 *  Message controller — the contact inbox.
 *
 *  Public:
 *    POST  /api/messages            submit a contact message
 *
 *  Dashboard (same access level as the other CMS routes in this codebase):
 *    GET    /api/messages           list messages (filter + search + paging)
 *    GET    /api/messages/unread-count
 *    GET    /api/messages/:id
 *    PATCH  /api/messages/:id       mark read/unread, star/unstar
 *    POST   /api/messages/:id/reply send a reply (dispatched via Resend)
 *    POST   /api/messages/read-all  mark every message as read
 *    DELETE /api/messages/:id
 * ─────────────────────────────────────────────────────────────────────────
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Identical submissions from the same email inside this window are dropped. */
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;
function clampString(value, max) {
    return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function hashBody(email, body) {
    return crypto_1.default
        .createHash("sha256")
        .update(`${email}\n${body}`)
        .digest("hex");
}
function serializeReply(reply) {
    return {
        id: String(reply._id ?? reply.id ?? ""),
        body: reply.body,
        sentAt: reply.sentAt,
    };
}
function serializeMessage(doc) {
    return {
        id: String(doc._id),
        leadId: doc.lead ? String(doc.lead) : null,
        name: doc.name,
        email: doc.email,
        subject: doc.subject,
        budget: doc.budget,
        body: doc.body,
        status: doc.status,
        starred: Boolean(doc.starred),
        replied: Boolean(doc.replied),
        replies: (doc.replies ?? []).map(serializeReply),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}
function serializeLead(doc) {
    return {
        id: String(doc._id),
        name: doc.name,
        email: doc.email,
        firstSeenAt: doc.firstSeenAt,
        lastSeenAt: doc.lastSeenAt,
        lastMessageAt: doc.lastMessageAt,
        messageCount: doc.messageCount,
        unreadCount: doc.unreadCount,
        replyCount: doc.replyCount,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}
/** Apply a signed `$inc` to a lead, ignoring null/undefined refs. */
async function bumpLead(leadId, inc) {
    if (!leadId)
        return null;
    return Lead_1.Lead.findByIdAndUpdate(leadId, { $inc: inc }, { new: true });
}
// ── Public — submit a new message ─────────────────────────────────────────
async function createMessage(req, res) {
    try {
        const name = clampString(req.body?.name, 160);
        const email = clampString(req.body?.email, 200).toLowerCase();
        const subject = clampString(req.body?.subject, 200) || "General Inquiry";
        const budget = clampString(req.body?.budget, 120);
        const body = clampString(req.body?.message ?? req.body?.body, 8000);
        const idempotencyKey = clampString(req.body?.idempotencyKey, 200);
        if (!name) {
            res.status(400).json({ success: false, message: "Name is required." });
            return;
        }
        if (!email || !EMAIL_RE.test(email)) {
            res
                .status(400)
                .json({ success: false, message: "A valid email is required." });
            return;
        }
        if (!body) {
            res.status(400).json({ success: false, message: "Message is required." });
            return;
        }
        // 1. Idempotency — the same form submit retried must not create a row.
        if (idempotencyKey) {
            const existing = await Message_1.Message.findOne({ idempotencyKey });
            if (existing) {
                res.status(200).json({
                    success: true,
                    deduplicated: true,
                    message: serializeMessage(existing),
                });
                return;
            }
        }
        // 2. Window dedupe — an identical body from the same email inside the
        //    window is treated as a repeat (double-click, refresh, flaky network).
        const bodyHash = hashBody(email, body);
        const recent = await Message_1.Message.findOne({
            email,
            bodyHash,
            createdAt: { $gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
        }).sort({ createdAt: -1 });
        if (recent) {
            res.status(200).json({
                success: true,
                deduplicated: true,
                message: serializeMessage(recent),
            });
            return;
        }
        // 3. Atomic upsert of the person (race-safe on the unique email).
        const now = new Date();
        const lead = await Lead_1.Lead.findOneAndUpdate({ email }, {
            $set: { name: name || "", lastSeenAt: now, lastMessageAt: now },
            $setOnInsert: { firstSeenAt: now },
            $inc: { messageCount: 1, unreadCount: 1 },
        }, { new: true, upsert: true, setDefaultsOnInsert: true });
        // 4. Store the message linked to the person.
        let message;
        try {
            message = await Message_1.Message.create({
                name,
                email,
                subject,
                budget,
                body,
                bodyHash,
                lead: lead?._id ?? null,
                idempotencyKey: idempotencyKey || undefined,
            });
        }
        catch (createError) {
            if (createError?.code === 11000 && idempotencyKey) {
                const existing = await Message_1.Message.findOne({ idempotencyKey });
                if (existing) {
                    res.status(200).json({
                        success: true,
                        deduplicated: true,
                        message: serializeMessage(existing),
                    });
                    return;
                }
            }
            throw createError;
        }
        // Best-effort admin alert — never blocks or fails the submission.
        void (0, mailer_1.sendNewMessageNotification)({ name, email, subject, budget, body });
        // Real-time dashboard notification.
        (0, sse_1.broadcast)("message", {
            id: String(message._id),
            leadId: lead ? String(lead._id) : null,
            name,
            email,
            subject,
            preview: body.slice(0, 120),
            at: Date.now(),
        });
        res.status(201).json({ success: true, message: serializeMessage(message) });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: err instanceof Error ? err.message : "Failed to send your message.",
        });
    }
}
// ── Dashboard — list ───────────────────────────────────────────────────────
async function getMessages(req, res) {
    try {
        const status = typeof req.query.status === "string" ? req.query.status : "";
        const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
        const starred = req.query.starred === "true";
        const limitRaw = parseInt(String(req.query.limit ?? "200"), 10);
        const limit = Number.isFinite(limitRaw)
            ? Math.min(Math.max(limitRaw, 1), 500)
            : 200;
        const filter = {};
        if (status === "unread" || status === "read")
            filter.status = status;
        if (starred)
            filter.starred = true;
        if (q) {
            const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            filter.$or = [
                { name: rx },
                { email: rx },
                { subject: rx },
                { body: rx },
            ];
        }
        const [messages, total, unread] = await Promise.all([
            Message_1.Message.find(filter).sort({ createdAt: -1 }).limit(limit),
            Message_1.Message.countDocuments(filter),
            Message_1.Message.countDocuments({ status: "unread" }),
        ]);
        res.status(200).json({
            success: true,
            messages: messages.map(serializeMessage),
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
// ── Dashboard — unread badge count ─────────────────────────────────────────
async function getUnreadCount(_req, res) {
    try {
        const unread = await Message_1.Message.countDocuments({ status: "unread" });
        res.status(200).json({ success: true, unread });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
// ── Dashboard — single ─────────────────────────────────────────────────────
async function getMessage(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ success: false, message: "Invalid message ID." });
            return;
        }
        const message = await Message_1.Message.findById(id);
        if (!message) {
            res.status(404).json({ success: false, message: "Message not found." });
            return;
        }
        res.status(200).json({ success: true, message: serializeMessage(message) });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
// ── Dashboard — mark read/unread, star ─────────────────────────────────────
async function updateMessage(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ success: false, message: "Invalid message ID." });
            return;
        }
        const updates = {};
        const { status, starred } = req.body ?? {};
        if (status !== undefined) {
            if (status !== "read" && status !== "unread") {
                res
                    .status(400)
                    .json({ success: false, message: "Invalid status value." });
                return;
            }
            updates.status = status;
        }
        if (starred !== undefined)
            updates.starred = Boolean(starred);
        if (Object.keys(updates).length === 0) {
            res.status(400).json({ success: false, message: "Nothing to update." });
            return;
        }
        const existing = await Message_1.Message.findById(id);
        if (!existing) {
            res.status(404).json({ success: false, message: "Message not found." });
            return;
        }
        const prevStatus = existing.status;
        const message = await Message_1.Message.findByIdAndUpdate(id, updates, { new: true });
        if (!message) {
            res.status(404).json({ success: false, message: "Message not found." });
            return;
        }
        // Keep the person's unread counter in sync when the status flips.
        if (status !== undefined && status !== prevStatus) {
            await bumpLead(message.lead, {
                unreadCount: status === "read" ? -1 : 1,
            });
        }
        (0, sse_1.broadcast)("message:update", {
            id,
            leadId: message.lead ? String(message.lead) : null,
            at: Date.now(),
        });
        res.status(200).json({ success: true, message: serializeMessage(message) });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
// ── Dashboard — reply via Resend ───────────────────────────────────────────
async function replyToMessage(req, res) {
    try {
        const { id } = req.params;
        const body = clampString(req.body?.body, 8000);
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ success: false, message: "Invalid message ID." });
            return;
        }
        if (!body) {
            res.status(400).json({ success: false, message: "Reply is required." });
            return;
        }
        const message = await Message_1.Message.findById(id);
        if (!message) {
            res.status(404).json({ success: false, message: "Message not found." });
            return;
        }
        const wasUnread = message.status === "unread";
        const wasReplied = message.replied;
        const result = await (0, mailer_1.sendReplyToVisitor)({
            to: message.email,
            name: message.name,
            subject: message.subject,
            body,
        });
        message.replies.push({ body, sentAt: new Date() });
        message.replied = true;
        message.status = "read";
        await message.save();
        // Keep the person's counters in sync.
        const inc = {};
        if (wasUnread)
            inc.unreadCount = -1;
        if (!wasReplied)
            inc.replyCount = 1;
        if (Object.keys(inc).length > 0)
            await bumpLead(message.lead, inc);
        (0, sse_1.broadcast)("message:update", {
            id,
            leadId: message.lead ? String(message.lead) : null,
            at: Date.now(),
        });
        res.status(200).json({
            success: true,
            delivered: result.sent,
            deliveryError: result.sent ? undefined : result.error,
            message: serializeMessage(message),
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: err instanceof Error ? err.message : "Failed to send reply.",
        });
    }
}
// ── Dashboard — mark all read ──────────────────────────────────────────────
async function markAllRead(_req, res) {
    try {
        const affected = await Message_1.Message.distinct("lead", { status: "unread" });
        const result = await Message_1.Message.updateMany({ status: "unread" }, { $set: { status: "read" } });
        const leadIds = affected.filter(Boolean);
        if (leadIds.length > 0) {
            await Lead_1.Lead.updateMany({ _id: { $in: leadIds } }, { $set: { unreadCount: 0 } });
        }
        (0, sse_1.broadcast)("message:update", { scope: "all", at: Date.now() });
        res.status(200).json({ success: true, modified: result.modifiedCount });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
// ── Dashboard — delete ─────────────────────────────────────────────────────
async function deleteMessage(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ success: false, message: "Invalid message ID." });
            return;
        }
        const message = await Message_1.Message.findByIdAndDelete(id);
        if (!message) {
            res.status(404).json({ success: false, message: "Message not found." });
            return;
        }
        // Keep the person's counters in sync and remove empty ghosts.
        if (message.lead) {
            const inc = { messageCount: -1 };
            if (message.status === "unread")
                inc.unreadCount = -1;
            if (message.replied)
                inc.replyCount = -1;
            const lead = await bumpLead(message.lead, inc);
            if (lead && lead.messageCount <= 0) {
                await Lead_1.Lead.deleteOne({ _id: lead._id });
            }
        }
        (0, sse_1.broadcast)("message:update", {
            id,
            leadId: message.lead ? String(message.lead) : null,
            at: Date.now(),
        });
        res
            .status(200)
            .json({ success: true, message: "Message deleted.", id });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
