import { Request, Response } from "express";
import mongoose from "mongoose";
import { Lead } from "../models/Lead";
import { Message } from "../models/Message";
import { broadcast } from "../lib/sse";
import { serializeLead, serializeMessage } from "./message.controller";

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Dashboard — list people ────────────────────────────────────────────────
export async function getLeads(req: Request, res: Response): Promise<void> {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const starred = req.query.starred === "true";

    const limitRaw = parseInt(String(req.query.limit ?? "200"), 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 500)
      : 200;

    const filter: Record<string, unknown> = {};
    if (status === "unread") filter.unreadCount = { $gt: 0 };
    if (status === "read") filter.unreadCount = { $lte: 0 };

    if (starred) {
      const ids = await Message.distinct("lead", { starred: true });
      filter._id = { $in: ids.filter(Boolean) };
    }

    if (q) {
      const rx = new RegExp(escapeRegExp(q), "i");
      const fromMessages = await Message.distinct("lead", { body: rx });
      filter.$or = [
        { name: rx },
        { email: rx },
        { _id: { $in: fromMessages.filter(Boolean) } },
      ];
    }

    const [leads, total, unread] = await Promise.all([
      Lead.find(filter).sort({ lastMessageAt: -1 }).limit(limit),
      Lead.countDocuments(filter),
      Message.countDocuments({ status: "unread" }),
    ]);

    // One preview (latest message) per listed person, plus a flag for people
    // who have starred at least one of their messages.
    const ids = leads.map((l) => l._id);
    const previewByLead = new Map<string, any>();
    const starredLeads = new Set<string>();
    if (ids.length > 0) {
      const recent = await Message.find({ lead: { $in: ids } })
        .sort({ createdAt: -1 })
        .lean();
      for (const m of recent) {
        const key = String(m.lead);
        if (!previewByLead.has(key)) previewByLead.set(key, m);
        if (m.starred) starredLeads.add(key);
      }
    }

    res.status(200).json({
      success: true,
      leads: leads.map((l) => {
        const preview = previewByLead.get(String(l._id));
        return {
          ...serializeLead(l),
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
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "Server error",
    });
  }
}

// ── Dashboard — one person + timeline ──────────────────────────────────────
export async function getLead(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid lead ID." });
      return;
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      res.status(404).json({ success: false, message: "Lead not found." });
      return;
    }

    const messages = await Message.find({ lead: id }).sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      lead: serializeLead(lead),
      messages: messages.map(serializeMessage),
    });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── Dashboard — mark a person's messages read ──────────────────────────────
export async function markLeadRead(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid lead ID." });
      return;
    }

    const lead = await Lead.findByIdAndUpdate(
      id,
      { $set: { unreadCount: 0 } },
      { new: true },
    );
    if (!lead) {
      res.status(404).json({ success: false, message: "Lead not found." });
      return;
    }

    await Message.updateMany(
      { lead: id, status: "unread" },
      { $set: { status: "read" } },
    );

    broadcast("message:update", { leadId: id, at: Date.now() });

    res.status(200).json({ success: true, lead: serializeLead(lead) });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── Dashboard — delete a person (and their messages) ───────────────────────
export async function deleteLead(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid lead ID." });
      return;
    }

    const lead = await Lead.findByIdAndDelete(id);
    if (!lead) {
      res.status(404).json({ success: false, message: "Lead not found." });
      return;
    }

    await Message.deleteMany({ lead: id });

    broadcast("message:update", { leadId: id, at: Date.now() });

    res.status(200).json({ success: true, message: "Lead deleted.", id });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}
