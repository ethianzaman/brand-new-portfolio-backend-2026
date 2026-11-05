import mongoose from "mongoose";
import { SkillCategory } from "../models/Skill";
import { uploadImage } from "../lib/cloudinary";
import { badRequest, conflict, notFound } from "../lib/http";
import { publishChange } from "../lib/publish";
import { removeFileIfUnused } from "./file.service";
import { escapeRegExp } from "../utils/request";

const ICON_FOLDER = "portfolio_skills";

type Body = Record<string, any>;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function assertCategoryId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw badRequest("Invalid category id.");
}

async function findCategory(id: string) {
  assertCategoryId(id);
  const category = await SkillCategory.findById(id);
  if (!category) throw notFound("Category not found.");
  return category;
}

export function listCategories() {
  return SkillCategory.find().sort({ order: 1 });
}

export async function addCategory({ label }: Body) {
  if (!label?.trim()) throw badRequest("Category label is required.");

  const exists = await SkillCategory.findOne({
    label: { $regex: new RegExp(`^${escapeRegExp(String(label).trim())}$`, "i") },
  });
  if (exists) throw conflict("Category already exists.");

  const last = await SkillCategory.findOne().sort({ order: -1 }).select("order");
  const category = await SkillCategory.create({
    label: label.trim(),
    order: last ? last.order + 1 : 0,
    skills: [],
  });

  await publishChange("skills");
  return category;
}

export async function renameCategory(id: string, { label }: Body) {
  assertCategoryId(id);

  const category = await SkillCategory.findByIdAndUpdate(
    id,
    { label },
    { new: true, runValidators: true },
  );
  if (!category) throw notFound("Category not found.");

  await publishChange("skills");
  return category;
}

export async function removeCategory(id: string) {
  assertCategoryId(id);

  const category = await SkillCategory.findByIdAndDelete(id);
  if (!category) throw notFound("Category not found.");

  for (const skill of category.skills) await removeFileIfUnused(skill.icon);
  await publishChange("skills");
}

export async function addSkill(id: string, { name, icon }: Body, file?: Express.Multer.File) {
  assertCategoryId(id);
  if (!name?.trim()) throw badRequest("Skill name is required.");

  const category = await SkillCategory.findById(id);
  if (!category) throw notFound("Category not found.");

  if (category.skills.some((skill: { name: string }) => sameName(skill.name, name))) {
    throw conflict("Skill already exists.");
  }

  if (!file && !icon?.trim()) throw badRequest("Please upload an image or provide an icon URL.");
  const finalIcon = file ? await uploadImage(file.buffer, ICON_FOLDER) : icon.trim();

  category.skills.push({ name: name.trim(), icon: finalIcon });
  await category.save();
  await publishChange("skills");
  return category;
}

/** Edits a skill in place, or moves it when a different category is named. */
export async function updateSkill(
  id: string,
  skillName: string,
  body: Body,
  file?: Express.Multer.File,
) {
  const source = await findCategory(id);

  const { targetCategoryId } = body;
  const destination =
    targetCategoryId && targetCategoryId !== id
      ? await SkillCategory.findById(targetCategoryId)
      : source;
  if (!destination) throw notFound("Destination category not found.");

  const oldName = decodeURIComponent(skillName);
  const skill = source.skills.find((s: { name: string }) => s.name === oldName);
  if (!skill) throw notFound("Skill not found.");

  const newName: string = body.name?.trim() ? body.name.trim() : skill.name;
  const oldIcon = skill.icon;
  let newIcon = skill.icon;
  if (file) {
    newIcon = await uploadImage(file.buffer, ICON_FOLDER);
  } else if (typeof body.icon === "string" && body.icon.trim() !== "") {
    newIcon = body.icon.trim();
  }

  const duplicate = destination.skills.some(
    (s: { name: string }) => sameName(s.name, newName) && s.name !== oldName,
  );
  if (duplicate) throw conflict("Skill already exists.");

  if (destination.id !== source.id) {
    source.skills = source.skills.filter((s: { name: string }) => s.name !== oldName);
    destination.skills.push({ name: newName, icon: newIcon });

    await source.save();
    await destination.save();
    await publishChange("skills");
    return { moved: true as const, sourceCategory: source, destinationCategory: destination };
  }

  skill.name = newName;
  skill.icon = newIcon;
  await source.save();
  await removeFileIfUnused(oldIcon);
  await publishChange("skills");
  return { moved: false as const, category: source };
}

export async function removeSkill(id: string, skillName: string) {
  const category = await findCategory(id);

  const name = decodeURIComponent(skillName);
  const skill = category.skills.find((s: { name: string }) => s.name === name);
  if (!skill) throw notFound("Skill not found.");

  category.skills = category.skills.filter((s: { name: string }) => s.name !== name);
  await category.save();
  await removeFileIfUnused(skill.icon);
  await publishChange("skills");
  return category;
}
