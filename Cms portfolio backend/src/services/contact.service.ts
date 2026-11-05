import mongoose from "mongoose";
import { Contact } from "../models/Contact";
import { badRequest, HttpError, notFound } from "../lib/http";
import { publishChange } from "../lib/publish";

const DEFAULT_FORM_OPTIONS = {
  services: [
    "Frontend Development",
    "Backend Development",
    "Full-Stack Web App",
    "API Integration",
    "Database Design",
    "Python / Django",
    "General Inquiry",
    "Other",
  ],
  budgets: [
    "Less than $500",
    "$500 – $1,000",
    "$1,000 – $3,000",
    "$3,000 – $5,000",
    "$5,000+",
    "Not sure yet",
  ],
};

const DEFAULT_CONTACT = {
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
};

const MAX_FORM_OPTIONS = 30;
const MAX_FORM_OPTION_LENGTH = 100;

type Body = Record<string, any>;

function parseOptionList(raw: unknown, label: string): string[] {
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
    throw badRequest(`${label} must be a list of text options`);
  }

  const seen = new Set<string>();
  const clean: string[] = [];

  for (const item of raw as string[]) {
    const text = item.trim();
    if (!text) continue;

    if (text.length > MAX_FORM_OPTION_LENGTH) {
      throw badRequest(`${label}: each option can be up to ${MAX_FORM_OPTION_LENGTH} characters`);
    }

    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(text);
  }

  if (clean.length > MAX_FORM_OPTIONS) {
    throw badRequest(`${label}: maximum ${MAX_FORM_OPTIONS} options allowed`);
  }
  return clean;
}

function formOptionsView(contact: { formOptions?: { services?: string[]; budgets?: string[] } }) {
  return {
    services: contact.formOptions?.services ?? DEFAULT_FORM_OPTIONS.services,
    budgets: contact.formOptions?.budgets ?? DEFAULT_FORM_OPTIONS.budgets,
  };
}

function faqView(faq: any) {
  const id = String(faq._id ?? faq.id);
  return { id, _id: id, question: faq.question, answer: faq.answer, order: faq.order };
}

async function getOrCreate() {
  return (await Contact.findOne()) ?? (await Contact.create(DEFAULT_CONTACT));
}

export async function getContact() {
  const contact = await getOrCreate();
  return {
    ...contact.toObject(),
    faqs: contact.faqs.map(faqView),
    formOptions: formOptionsView(contact),
  };
}

export async function updateInfo(info: Body) {
  const contact = await Contact.findOneAndUpdate(
    {},
    { $set: { info } },
    { new: true, upsert: true, runValidators: true },
  );
  if (!contact) throw new HttpError(500, "Failed to update contact information.");

  await publishChange("contact");
  return contact.info;
}

export async function updateFormOptions(body: Body) {
  const services = parseOptionList(body?.services, "Service needed");
  const budgets = parseOptionList(body?.budgets, "Estimated budget");

  const contact = await Contact.findOneAndUpdate(
    {},
    { $set: { formOptions: { services, budgets } } },
    { new: true },
  );
  if (!contact) throw notFound("Contact not found.");

  await publishChange("contact");
  return formOptionsView(contact);
}

export async function addFaq({ question, answer }: Body) {
  if (
    typeof question !== "string" ||
    typeof answer !== "string" ||
    !question.trim() ||
    !answer.trim()
  ) {
    throw badRequest("Question and answer are required.");
  }

  const contact = await getOrCreate();
  contact.faqs.push({
    question: question.trim(),
    answer: answer.trim(),
    order: contact.faqs.length + 1,
  } as any);
  await contact.save();

  await publishChange("contact");
  return faqView(contact.faqs[contact.faqs.length - 1]);
}

function faqObjectId(id: string) {
  if (!mongoose.isValidObjectId(id)) throw badRequest("Invalid FAQ ID.");
  return new mongoose.Types.ObjectId(id);
}

const isBlank = (value: unknown) => typeof value !== "string" || !value.trim();

export async function editFaq(id: string, { question, answer }: Body) {
  const _id = faqObjectId(id);

  if ((question !== undefined && isBlank(question)) || (answer !== undefined && isBlank(answer))) {
    throw badRequest("Question and answer must be non-empty strings.");
  }
  if (question === undefined && answer === undefined) {
    throw badRequest("At least one field is required.");
  }

  const changes: Record<string, string> = {};
  if (question !== undefined) changes["faqs.$.question"] = question.trim();
  if (answer !== undefined) changes["faqs.$.answer"] = answer.trim();

  const contact = await Contact.findOneAndUpdate(
    { "faqs._id": _id },
    { $set: changes },
    { new: true, runValidators: true },
  );
  if (!contact) throw notFound("FAQ not found.");

  const updated = contact.faqs.find((faq: any) => String(faq._id) === id);
  if (!updated) throw notFound("Updated FAQ not found.");

  await publishChange("contact");
  return faqView(updated);
}

export async function removeFaq(id: string) {
  const _id = faqObjectId(id);

  const contact = await Contact.findOneAndUpdate(
    { "faqs._id": _id },
    { $pull: { faqs: { _id } } },
    { new: true },
  );
  if (!contact) throw notFound("FAQ not found.");

  await publishChange("contact");
}
