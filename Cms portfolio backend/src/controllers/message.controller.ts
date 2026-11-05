import { handle } from "../lib/http";
import * as messages from "../services/message.service";

export const createMessage = handle(
  async (req, res) => {
    const { message, deduplicated } = await messages.submit(req.body);
    if (deduplicated) {
      res.status(200).json({ success: true, deduplicated: true, message });
      return;
    }
    res.status(201).json({ success: true, message });
  },
  { status: 500, message: "Failed to send your message." },
);

export const getMessages = handle(
  async (req, res) => {
    res.status(200).json({ success: true, ...(await messages.list(req.query)) });
  },
  { status: 500, message: "Server error" },
);

export const getUnreadCount = handle(async (_req, res) => {
  res.status(200).json({ success: true, unread: await messages.unreadCount() });
});

export const getInboxStats = handle(async (req, res) => {
  res.status(200).json({ success: true, stats: await messages.inboxStats(req.query.tz) });
});

export const getMessage = handle(async (req, res) => {
  res.status(200).json({ success: true, message: await messages.getOne(req.params.id) });
});

export const updateMessage = handle(async (req, res) => {
  res.status(200).json({ success: true, message: await messages.update(req.params.id, req.body) });
});

export const replyToMessage = handle(
  async (req, res) => {
    res.status(200).json({ success: true, ...(await messages.reply(req.params.id, req.body)) });
  },
  { status: 500, message: "Failed to send reply." },
);

export const markAllRead = handle(async (_req, res) => {
  res.status(200).json({ success: true, modified: await messages.markAllRead() });
});

export const deleteMessage = handle(async (req, res) => {
  await messages.remove(req.params.id);
  res.status(200).json({ success: true, message: "Message deleted.", id: req.params.id });
});
