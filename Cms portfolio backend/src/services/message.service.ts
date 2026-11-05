import crypto from "crypto";
import mongoose from "mongoose";
import type { ParsedQs } from "qs";
import { Lead } from "../models/Lead";
import { Message } from "../models/Message";
import { badRequest, notFound } from "../lib/http";
import { sendNewMessageNotification, sendReplyToVisitor } from "../lib/mailer";
import { broadcastInbox } from "../lib/sse";
import { escapeRegExp } from "../utils/request";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Identical submissions from the same email inside this window are dropped. */
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const TREND_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type Body = Record<string, any>;

function clampString(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function hashBody(email: string, body: string): string {
  return crypto.createHash("sha256").update(`${email}\n${body}`).digest("hex");
}

export function serializeMessage(doc: any) {
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
    replies: (doc.replies ?? []).map((reply: any) => ({
      id: String(reply._id ?? reply.id ?? ""),
      body: reply.body,
      sentAt: reply.sentAt,
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** Limit for the inbox and people lists, from a raw query value. */
export function listLimit(raw: unknown): number {
  const limit = parseInt(String(raw ?? "200"), 10);
  return Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 200;
}

function assertMessageId(id: string) {
  if (!mongoose.isValidObjectId(id)) throw badRequest("Invalid message ID.");
}

function adjustLead(leadId: unknown, inc: Record<string, number>): Promise<any | null> {
  if (!leadId) return Promise.resolve(null);
  return Lead.findByIdAndUpdate(leadId, { $inc: inc }, { new: true });
}

function announceUpdate(id: string, lead: unknown) {
  broadcastInbox("message:update", {
    id,
    leadId: lead ? String(lead) : null,
    at: Date.now(),
  });
}

export async function submit(input: Body) {
  const name = clampString(input?.name, 160);
  const email = clampString(input?.email, 200).toLowerCase();
  const subject = clampString(input?.subject, 200) || "General Inquiry";
  const budget = clampString(input?.budget, 120);
  const body = clampString(input?.message ?? input?.body, 8000);
  const idempotencyKey = clampString(input?.idempotencyKey, 200);

  if (!name) throw badRequest("Name is required.");
  if (!email || !EMAIL_RE.test(email)) throw badRequest("A valid email is required.");
  if (!body) throw badRequest("Message is required.");

  // The same form submit retried must not create a row.
  if (idempotencyKey) {
    const existing = await Message.findOne({ idempotencyKey });
    if (existing) return { message: serializeMessage(existing), deduplicated: true };
  }

  // A double-click, refresh or flaky network sends an identical body again.
  const bodyHash = hashBody(email, body);
  const recent = await Message.findOne({
    email,
    bodyHash,
    createdAt: { $gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
  }).sort({ createdAt: -1 });
  if (recent) return { message: serializeMessage(recent), deduplicated: true };

  // Atomic upsert, so two messages at once can't create the same person twice.
  const now = new Date();
  const lead = await Lead.findOneAndUpdate(
    { email },
    {
      $set: { name, lastSeenAt: now, lastMessageAt: now },
      $setOnInsert: { firstSeenAt: now },
      $inc: { messageCount: 1, unreadCount: 1 },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  let message;
  try {
    message = await Message.create({
      name,
      email,
      subject,
      budget,
      body,
      bodyHash,
      lead: lead?._id ?? null,
      idempotencyKey: idempotencyKey || undefined,
    });
  } catch (err: any) {
    if (err?.code === 11000 && idempotencyKey) {
      const existing = await Message.findOne({ idempotencyKey });
      if (existing) return { message: serializeMessage(existing), deduplicated: true };
    }
    throw err;
  }

  // Best effort: a mail problem never fails the visitor's submission.
  void sendNewMessageNotification({ name, email, subject, budget, body });

  broadcastInbox("message", {
    id: String(message._id),
    leadId: lead ? String(lead._id) : null,
    name,
    email,
    subject,
    preview: body.slice(0, 120),
    at: Date.now(),
  });

  return { message: serializeMessage(message), deduplicated: false };
}

export async function list(query: ParsedQs) {
  const status = typeof query.status === "string" ? query.status : "";
  const q = typeof query.q === "string" ? query.q.trim() : "";

  const filter: Record<string, unknown> = {};
  if (status === "unread" || status === "read") filter.status = status;
  if (query.starred === "true") filter.starred = true;
  if (q) {
    const rx = new RegExp(escapeRegExp(q), "i");
    filter.$or = [{ name: rx }, { email: rx }, { subject: rx }, { body: rx }];
  }

  const [messages, total, unread] = await Promise.all([
    Message.find(filter).sort({ createdAt: -1 }).limit(listLimit(query.limit)),
    Message.countDocuments(filter),
    Message.countDocuments({ status: "unread" }),
  ]);

  return { messages: messages.map(serializeMessage), total, unread };
}

export function unreadCount() {
  return Message.countDocuments({ status: "unread" });
}

function safeTimeZone(value: unknown): string {
  if (typeof value !== "string" || value.length > 64) return "UTC";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value });
    return value;
  } catch {
    return "UTC";
  }
}

/** Real inbox numbers: totals, messages per day in the reader's zone, budgets. */
export async function inboxStats(tz: unknown) {
  const timeZone = safeTimeZone(tz);
  const now = Date.now();
  const dayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // Two whole periods, so this month can be compared with the one before.
  const dates: string[] = [];
  for (let back = TREND_DAYS * 2 - 1; back >= 0; back -= 1) {
    dates.push(dayKey.format(now - back * DAY_MS));
  }

  const [result] = await Message.aggregate([
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              unread: { $sum: { $cond: [{ $eq: ["$status", "unread"] }, 1, 0] } },
              awaitingReply: { $sum: { $cond: [{ $ne: ["$replied", true] }, 1, 0] } },
            },
          },
        ],
        daily: [
          { $match: { createdAt: { $gte: new Date(now - (TREND_DAYS * 2 + 1) * DAY_MS) } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: timeZone } },
              count: { $sum: 1 },
            },
          },
        ],
        budgets: [{ $group: { _id: "$budget", count: { $sum: 1 } } }],
      },
    },
  ]);

  const perDay = new Map<string, number>(
    result.daily.map((d: { _id: string; count: number }) => [d._id, d.count]),
  );
  const series = dates.map((date) => ({ date, count: perDay.get(date) ?? 0 }));

  const budgets = new Map<string, number>();
  for (const { _id, count } of result.budgets as { _id: unknown; count: number }[]) {
    const label = (typeof _id === "string" && _id.trim()) || "Not specified";
    budgets.set(label, (budgets.get(label) ?? 0) + count);
  }

  const totals = result.totals[0];
  return {
    total: totals?.total ?? 0,
    unread: totals?.unread ?? 0,
    awaitingReply: totals?.awaitingReply ?? 0,
    days: series.slice(-TREND_DAYS),
    previous30: series.slice(0, -TREND_DAYS).reduce((sum, day) => sum + day.count, 0),
    budgets: Array.from(budgets, ([label, count]) => ({ label, count })),
  };
}

export async function getOne(id: string) {
  assertMessageId(id);
  const message = await Message.findById(id);
  if (!message) throw notFound("Message not found.");
  return serializeMessage(message);
}

/** Mark read or unread, star or unstar. */
export async function update(id: string, body: Body) {
  assertMessageId(id);

  const { status, starred } = body ?? {};
  const changes: Record<string, unknown> = {};

  if (status !== undefined) {
    if (status !== "read" && status !== "unread") throw badRequest("Invalid status value.");
    changes.status = status;
  }
  if (starred !== undefined) changes.starred = Boolean(starred);
  if (Object.keys(changes).length === 0) throw badRequest("Nothing to update.");

  const existing = await Message.findById(id);
  if (!existing) throw notFound("Message not found.");

  const previousStatus = existing.status;
  const message = await Message.findByIdAndUpdate(id, changes, { new: true });
  if (!message) throw notFound("Message not found.");

  if (status !== undefined && status !== previousStatus) {
    await adjustLead(message.lead, { unreadCount: status === "read" ? -1 : 1 });
  }

  announceUpdate(id, message.lead);
  return serializeMessage(message);
}

export async function reply(id: string, input: Body) {
  assertMessageId(id);
  const body = clampString(input?.body, 8000);
  if (!body) throw badRequest("Reply is required.");

  const message = await Message.findById(id);
  if (!message) throw notFound("Message not found.");

  const wasUnread = message.status === "unread";
  const wasReplied = message.replied;

  const result = await sendReplyToVisitor({
    to: message.email,
    name: message.name,
    subject: message.subject,
    body,
  });

  message.replies.push({ body, sentAt: new Date() } as any);
  message.replied = true;
  message.status = "read";
  await message.save();

  const inc: Record<string, number> = {};
  if (wasUnread) inc.unreadCount = -1;
  if (!wasReplied) inc.replyCount = 1;
  if (Object.keys(inc).length > 0) await adjustLead(message.lead, inc);

  announceUpdate(id, message.lead);

  return {
    delivered: result.sent,
    deliveryError: result.sent ? undefined : result.error,
    message: serializeMessage(message),
  };
}

export async function markAllRead() {
  const affected = await Message.distinct("lead", { status: "unread" });
  const result = await Message.updateMany({ status: "unread" }, { $set: { status: "read" } });

  const leadIds = affected.filter(Boolean);
  if (leadIds.length > 0) {
    await Lead.updateMany({ _id: { $in: leadIds } }, { $set: { unreadCount: 0 } });
  }

  broadcastInbox("message:update", { scope: "all", at: Date.now() });
  return result.modifiedCount;
}

export async function remove(id: string) {
  assertMessageId(id);

  const message = await Message.findByIdAndDelete(id);
  if (!message) throw notFound("Message not found.");

  // Keep the person's counters right, and don't leave someone with no messages.
  if (message.lead) {
    const inc: Record<string, number> = { messageCount: -1 };
    if (message.status === "unread") inc.unreadCount = -1;
    if (message.replied) inc.replyCount = -1;

    const lead = await adjustLead(message.lead, inc);
    if (lead && lead.messageCount <= 0) await Lead.deleteOne({ _id: lead._id });
  }

  announceUpdate(id, message.lead);
}
