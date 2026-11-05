import { handle } from "../lib/http";
import * as contacts from "../services/contact.service";

export const getContact = handle(
  async (_req, res) => {
    res.status(200).json({ success: true, contact: await contacts.getContact() });
  },
  { status: 500, message: "Server error" },
);

export const updateInfo = handle(
  async (req, res) => {
    res.status(200).json({ success: true, info: await contacts.updateInfo(req.body) });
  },
  { status: 400, message: "Failed to update contact." },
);

export const updateFormOptions = handle(
  async (req, res) => {
    const formOptions = await contacts.updateFormOptions(req.body);
    res.status(200).json({ success: true, formOptions });
  },
  { status: 500, message: "Failed to update the form options." },
);

export const createFAQ = handle(
  async (req, res) => {
    res.status(201).json({ success: true, faq: await contacts.addFaq(req.body) });
  },
  { status: 400, message: "Failed to create FAQ." },
);

export const updateFAQ = handle(
  async (req, res) => {
    res.status(200).json({ success: true, faq: await contacts.editFaq(req.params.id, req.body) });
  },
  { status: 400, message: "Failed to update FAQ." },
);

export const deleteFAQ = handle(
  async (req, res) => {
    await contacts.removeFaq(req.params.id);
    res.status(200).json({ success: true, message: "FAQ deleted successfully.", id: req.params.id });
  },
  { status: 400, message: "Failed to delete FAQ." },
);
