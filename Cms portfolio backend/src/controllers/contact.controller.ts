import { Request, Response } from "express";
import { Contact } from "../models/Contact";
import mongoose from "mongoose";
import { publishChange } from "../lib/publish";


export async function getContact(req: Request, res: Response): Promise<void> {
  try {
    let contact = await Contact.findOne();
    if (!contact) {
      contact = await Contact.create({
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
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}


export async function updateInfo(req: Request, res: Response): Promise<void> {
  try {
    const contact = await Contact.findOneAndUpdate(
      {},
      { $set: { info: req.body } },
      { new: true, upsert: true },
    );
    await publishChange("contact");
    res.status(200).json({ success: true, info: contact.info });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}


export async function createFAQ(req: Request, res: Response): Promise<void> {
  try {
    const count = await Contact.findOne().then((c) => c?.faqs.length ?? 0);
    const faq = { ...req.body, id: `faq-${Date.now()}`, order: count + 1 };
    const contact = await Contact.findOneAndUpdate(
      {},
      { $push: { faqs: faq } },
      { new: true, upsert: true },
    );
    await publishChange("contact");
    res.status(201).json({ success: true, faq });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function updateFAQ(req: Request, res: Response): Promise<void> {
  try {
    const faqId = new mongoose.Types.ObjectId(req.params.id);

    const contact = await Contact.findOneAndUpdate(
      {
        "faqs._id": faqId,
      },
      {
        $set: {
          "faqs.$.question": req.body.question,
          "faqs.$.answer": req.body.answer,
        },
      },
      {
        new: true,
      },
    );

    if (!contact) {
      res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
      return;
    }

    const updated = contact.faqs.find(
      (faq: any) => faq._id.toString() === req.params.id,
    );
    await publishChange("contact");
    res.status(200).json({
      success: true,
      faq: updated,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
}

export async function deleteFAQ(req: Request, res: Response): Promise<void> {
  try {
    const contact = await Contact.findOneAndUpdate(
      {},
      {
        $pull: {
          faqs: {
            _id: new mongoose.Types.ObjectId(req.params.id),
          },
        },
      },
      { new: true },
    );

    if (!contact) {
      res.status(404).json({
        success: false,
        message: "Contact not found",
      });
      return;
    }
    await publishChange("contact");

    res.status(200).json({
      success: true,
      message: "FAQ deleted",
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
}
