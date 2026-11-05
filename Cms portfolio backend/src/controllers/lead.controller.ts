import { handle } from "../lib/http";
import * as leads from "../services/lead.service";

export const getLeads = handle(
  async (req, res) => {
    res.status(200).json({ success: true, ...(await leads.list(req.query)) });
  },
  { status: 500, message: "Server error" },
);

export const getLead = handle(async (req, res) => {
  res.status(200).json({ success: true, ...(await leads.getWithTimeline(req.params.id)) });
});

export const markLeadRead = handle(async (req, res) => {
  res.status(200).json({ success: true, lead: await leads.markRead(req.params.id) });
});

export const deleteLead = handle(async (req, res) => {
  await leads.remove(req.params.id);
  res.status(200).json({ success: true, message: "Lead deleted.", id: req.params.id });
});
