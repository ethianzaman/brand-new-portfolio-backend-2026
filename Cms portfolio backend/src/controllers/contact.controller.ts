import { Request, Response } from "express";
import mongoose from "mongoose";
import { Contact } from "../models/Contact";
import { publishChange } from "../lib/publish";

function serializeFAQ(faq: any) {
  const id = String(faq._id ?? faq.id);

  return {
    id,
    _id: id,
    question: faq.question,
    answer: faq.answer,
    order: faq.order,
  };
}

export async function getContact(
  req: Request,
  res: Response,
): Promise<void> {
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
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      message:
        err instanceof Error ? err.message : "Server erroclerr",
    });
  }
}

export async function updateInfo(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const contact = await Contact.findOneAndUpdate(
      {},
      { $set: { info: req.body } },
      {
        new: true,
        upsert: true,
        runValidators: true,
      },
    );

    if (!contact) {
      res.status(500).json({
        success: false,
        message: "Failed to update contact information.",
      });
      return;
    }

    await publishChange("contact");

    res.status(200).json({
      success: true,
      info: contact.info,
    });
  } catch (err: unknown) {
    res.status(400).json({
      success: false,
      message:
        err instanceof Error ? err.message : "Failed to update contact.",
    });
  }
}

export async function createFAQ(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { question, answer } = req.body;

    if (
      typeof question !== "string" ||
      typeof answer !== "string" ||
      !question.trim() ||
      !answer.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Question and answer are required.",
      });
      return;
    }

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
    } as any);

    await contact.save();

    const createdFAQ = contact.faqs[contact.faqs.length - 1];

    await publishChange("contact");

    res.status(201).json({
      success: true,
      faq: serializeFAQ(createdFAQ),
    });
  } catch (err: unknown) {
    res.status(400).json({
      success: false,
      message:
        err instanceof Error ? err.message : "Failed to create FAQ.",
    });
  }
}

export async function updateFAQ(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;
    const { question, answer } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid FAQ ID.",
      });
      return;
    }

    if (
      (question !== undefined &&
        (typeof question !== "string" || !question.trim())) ||
      (answer !== undefined &&
        (typeof answer !== "string" || !answer.trim()))
    ) {
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

    const updates: Record<string, string> = {};

    if (question !== undefined) {
      updates["faqs.$.question"] = question.trim();
    }

    if (answer !== undefined) {
      updates["faqs.$.answer"] = answer.trim();
    }

    const contact = await Contact.findOneAndUpdate(
      { "faqs._id": new mongoose.Types.ObjectId(id) },
      { $set: updates },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!contact) {
      res.status(404).json({
        success: false,
        message: "FAQ not found.",
      });
      return;
    }

    const updatedFAQ = contact.faqs.find(
      (faq: any) => String(faq._id) === id,
    );

    if (!updatedFAQ) {
      res.status(404).json({
        success: false,
        message: "Updated FAQ not found.",
      });
      return;
    }

    await publishChange("contact");

    res.status(200).json({
      success: true,
      faq: serializeFAQ(updatedFAQ),
    });
  } catch (err: unknown) {
    res.status(400).json({
      success: false,
      message:
        err instanceof Error ? err.message : "Failed to update FAQ.",
    });
  }
}

export async function deleteFAQ(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid FAQ ID.",
      });
      return;
    }

    const contact = await Contact.findOneAndUpdate(
      { "faqs._id": new mongoose.Types.ObjectId(id) },
      {
        $pull: {
          faqs: {
            _id: new mongoose.Types.ObjectId(id),
          },
        },
      },
      { new: true },
    );

    if (!contact) {
      res.status(404).json({
        success: false,
        message: "FAQ not found.",
      });
      return;
    }

    await publishChange("contact");

    res.status(200).json({
      success: true,
      message: "FAQ deleted successfully.",
      id,
    });
  } catch (err: unknown) {
    res.status(400).json({
      success: false,
      message:
        err instanceof Error ? err.message : "Failed to delete FAQ.",
    });
  }
}
