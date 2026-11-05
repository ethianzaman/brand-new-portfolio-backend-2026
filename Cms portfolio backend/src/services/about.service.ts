import mongoose from "mongoose";
import { About } from "../models/About";
import { uploadImage, uploadResume } from "../lib/cloudinary";
import { badRequest, notFound } from "../lib/http";
import { publishChange } from "../lib/publish";
import { removeFileIfUnused } from "./file.service";
import { firstUnsafeLink, pick } from "../utils/request";

const HERO_FIELDS = ["name", "title", "subtitle", "bio", "image", "resumeUrl", "location", "experience"];
const EXPERIENCE_FIELDS = ["role", "company", "type", "period", "current", "description", "tags"];
const EDUCATION_FIELDS = ["degree", "school", "period", "description", "grade"];
const VALUE_FIELDS = ["icon", "title", "desc"];

type Body = Record<string, any>;

export interface AboutFiles {
  image?: Express.Multer.File[];
  resume?: Express.Multer.File[];
}

export async function getAbout() {
  return (
    (await About.findOne()) ??
    (await About.create({
      hero: {
        name: "Your Name",
        title: "Full Stack Developer",
        subtitle: "Building great web products",
        bio: ["Your bio here."],
        image: null,
        resumeUrl: "/resume.pdf",
        location: "Remote",
        experience: "1+ Year",
      },
      experiences: [],
      educations: [],
      values: [],
    }))
  );
}

/** A form sends bio as JSON or as plain text; it is stored as paragraphs. */
function parseBio(bio: string): unknown[] {
  try {
    const parsed = JSON.parse(bio);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [bio];
  }
}

export async function updateHero(body: Body, files?: AboutFiles) {
  const unsafe = firstUnsafeLink(body ?? {}, ["image", "resumeUrl"]);
  if (unsafe) throw badRequest(`${unsafe} must be an http(s) link`);

  const hero: Body = pick(body, HERO_FIELDS);
  const imageFile = files?.image?.[0];
  const resumeFile = files?.resume?.[0];

  if (resumeFile && resumeFile.mimetype !== "application/pdf") {
    throw badRequest("Resume must be a PDF file");
  }

  if (resumeFile) hero.resumeUrl = await uploadResume(resumeFile.buffer, "portfolio_resume");
  if (imageFile) hero.image = await uploadImage(imageFile.buffer, "portfolio_about");
  if (hero.bio && typeof hero.bio === "string") hero.bio = parseBio(hero.bio);

  const changes = Object.fromEntries(
    Object.entries(hero).map(([key, value]) => [`hero.${key}`, value]),
  );

  const previous = (await About.findOne().lean()) as {
    hero?: { image?: string | null; resumeUrl?: string };
  } | null;
  const about = await About.findOneAndUpdate({}, { $set: changes }, { new: true, upsert: true });

  await removeFileIfUnused(previous?.hero?.image);
  await removeFileIfUnused(previous?.hero?.resumeUrl);
  await publishChange("about");
  return about.hero;
}

// ── The three lists on the page work the same way ─────────────────────

interface Section {
  path: "experiences" | "educations" | "values";
  label: string;
  title: string;
  fields: string[];
  /** Tell an empty request apart from one with only unknown fields. */
  checksEmptyBody: boolean;
}

const EXPERIENCES: Section = {
  path: "experiences",
  label: "experience",
  title: "Experience",
  fields: EXPERIENCE_FIELDS,
  checksEmptyBody: true,
};
const EDUCATIONS: Section = {
  path: "educations",
  label: "education",
  title: "Education",
  fields: EDUCATION_FIELDS,
  checksEmptyBody: true,
};
const VALUES: Section = {
  path: "values",
  label: "value",
  title: "Value",
  fields: VALUE_FIELDS,
  checksEmptyBody: false,
};

function objectId(section: Section, id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw badRequest(`Invalid ${section.label} ObjectId`);
  return new mongoose.Types.ObjectId(id);
}

async function addFirst(section: Section, item: Body) {
  const about = await About.findOneAndUpdate(
    {},
    { $push: { [section.path]: { $each: [item], $position: 0 } } },
    { new: true, upsert: true },
  );
  await publishChange("about");
  return about;
}

async function editItem(section: Section, id: string, body: Body) {
  const _id = objectId(section, id);

  if (section.checksEmptyBody && (!body || Object.keys(body).length === 0)) {
    throw badRequest("No update data provided");
  }

  const changes: Record<string, unknown> = {};
  for (const field of section.fields) {
    if (body[field] !== undefined) changes[`${section.path}.$.${field}`] = body[field];
  }
  if (Object.keys(changes).length === 0) throw badRequest("No valid fields to update");

  const about = await About.findOneAndUpdate(
    { [`${section.path}._id`]: _id },
    { $set: changes },
    { new: true, runValidators: true },
  );
  if (!about) throw notFound(`${section.title} not found`);

  await publishChange("about");
  return (about[section.path] as { _id: mongoose.Types.ObjectId }[]).find((item) =>
    item._id.equals(_id),
  );
}

async function removeItem(section: Section, id: string) {
  const _id = objectId(section, id);

  const about = await About.findOneAndUpdate(
    { [`${section.path}._id`]: _id },
    { $pull: { [section.path]: { _id } } },
    { new: true },
  );
  if (!about) throw notFound(`${section.title} not found`);

  await publishChange("about");
}

export async function addExperience(body: Body) {
  const about = await addFirst(EXPERIENCES, { ...pick(body, EXPERIENCE_FIELDS), id: `exp-${Date.now()}` });
  return { experience: about.experiences[0], allExperiences: about.experiences };
}
export const editExperience = (id: string, body: Body) => editItem(EXPERIENCES, id, body);
export const removeExperience = (id: string) => removeItem(EXPERIENCES, id);

export async function addEducation(body: Body) {
  const about = await addFirst(EDUCATIONS, { ...pick(body, EDUCATION_FIELDS), id: `edu-${Date.now()}` });
  return about.educations[0];
}
export const editEducation = (id: string, body: Body) => editItem(EDUCATIONS, id, body);
export const removeEducation = (id: string) => removeItem(EDUCATIONS, id);

/** Values keep the order they were added in, unlike the two lists above. */
export async function addValue(body: Body) {
  const value = { ...pick(body, VALUE_FIELDS), _id: new mongoose.Types.ObjectId() };
  await About.findOneAndUpdate({}, { $push: { values: value } }, { new: true, upsert: true });
  await publishChange("about");
  return value;
}
export const editValue = (id: string, body: Body) => editItem(VALUES, id, body);
export const removeValue = (id: string) => removeItem(VALUES, id);
