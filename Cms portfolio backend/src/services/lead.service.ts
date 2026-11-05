import mongoose from "mongoose";
import type { ParsedQs } from "qs";
import { Lead } from "../models/Lead";
import { Message } from "../models/Message";
import { badRequest, notFound } from "../lib/http";
import { broadcastInbox } from "../lib/sse";
import { escapeRegExp } from "../utils/request";
import { listLimit, serializeMessage } from "./message.service";

/**
 * The people behind the inbox: messages grouped by person, keyed on the email
 * address. Separate from the Contact document, which holds the contact page.
 */

function serializeLead(doc: any) {
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

function assertLeadId(id: string) {
  if (!mongoose.isValidObjectId(id)) throw badRequest("Invalid lead ID.");
}

export async function list(query: ParsedQs) {
  const status = typeof query.status === "string" ? query.status : "";
  const q = typeof query.q === "string" ? query.q.trim() : "";

  const filter: Record<string, unknown> = {};
  if (status === "unread") filter.unreadCount = { $gt: 0 };
  if (status === "read") filter.unreadCount = { $lte: 0 };

  if (query.starred === "true") {
    const ids = await Message.distinct("lead", { starred: true });
    filter._id = { $in: ids.filter(Boolean) };
  }

  if (q) {
    const rx = new RegExp(escapeRegExp(q), "i");
    const fromMessages = await Message.distinct("lead", { body: rx });
    filter.$or = [{ name: rx }, { email: rx }, { _id: { $in: fromMessages.filter(Boolean) } }];
  }

  const [leads, total, unread] = await Promise.all([
    Lead.find(filter).sort({ lastMessageAt: -1 }).limit(listLimit(query.limit)),
    Lead.countDocuments(filter),
    Message.countDocuments({ status: "unread" }),
  ]);

  // The latest message per person, and who starred at least one message.
  const previewByLead = new Map<string, any>();
  const starredLeads = new Set<string>();
  const ids = leads.map((lead) => lead._id);
  if (ids.length > 0) {
    const recent = await Message.find({ lead: { $in: ids } }).sort({ createdAt: -1 }).lean();
    for (const message of recent) {
      const key = String(message.lead);
      if (!previewByLead.has(key)) previewByLead.set(key, message);
      if (message.starred) starredLeads.add(key);
    }
  }

  return {
    leads: leads.map((lead) => {
      const preview = previewByLead.get(String(lead._id));
      return {
        ...serializeLead(lead),
        hasStarred: starredLeads.has(String(lead._id)),
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
  };
}

export async function getWithTimeline(id: string) {
  assertLeadId(id);

  const lead = await Lead.findById(id);
  if (!lead) throw notFound("Lead not found.");

  const messages = await Message.find({ lead: id }).sort({ createdAt: 1 });
  return { lead: serializeLead(lead), messages: messages.map(serializeMessage) };
}

export async function markRead(id: string) {
  assertLeadId(id);

  const lead = await Lead.findByIdAndUpdate(id, { $set: { unreadCount: 0 } }, { new: true });
  if (!lead) throw notFound("Lead not found.");

  await Message.updateMany({ lead: id, status: "unread" }, { $set: { status: "read" } });
  broadcastInbox("message:update", { leadId: id, at: Date.now() });
  return serializeLead(lead);
}

/** Removes the person and all of their messages. */
export async function remove(id: string) {
  assertLeadId(id);

  const lead = await Lead.findByIdAndDelete(id);
  if (!lead) throw notFound("Lead not found.");

  await Message.deleteMany({ lead: id });
  broadcastInbox("message:update", { leadId: id, at: Date.now() });
}
