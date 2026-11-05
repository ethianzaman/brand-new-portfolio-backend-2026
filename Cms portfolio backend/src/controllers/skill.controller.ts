import { handle } from "../lib/http";
import * as skills from "../services/skill.service";

const CATEGORY_FAILURE = { status: 500, message: "Request failed" };
const SKILL_FAILURE = { status: 500, message: "Internal server error." };

export const getSkills = handle(async (_req, res) => {
  res.status(200).json({ success: true, categories: await skills.listCategories() });
});

export const createCategory = handle(async (req, res) => {
  const category = await skills.addCategory(req.body);
  res.status(201).json({ success: true, message: "Category created successfully.", category });
}, CATEGORY_FAILURE);

export const updateCategory = handle(async (req, res) => {
  const category = await skills.renameCategory(req.params.id, req.body);
  res.status(200).json({ success: true, message: "Category updated successfully.", category });
}, CATEGORY_FAILURE);

export const deleteCategory = handle(async (req, res) => {
  await skills.removeCategory(req.params.id);
  res.status(200).json({ success: true, message: "Category deleted successfully." });
}, CATEGORY_FAILURE);

export const addSkill = handle(async (req, res) => {
  const category = await skills.addSkill(req.params.id, req.body, req.file);
  res.status(201).json({ success: true, message: "Skill created successfully.", category });
}, SKILL_FAILURE);

export const updateSkill = handle(async (req, res) => {
  const { moved, ...categories } = await skills.updateSkill(
    req.params.id,
    req.params.skillName,
    req.body,
    req.file,
  );
  res.status(200).json({
    success: true,
    message: moved ? "Skill moved successfully." : "Skill updated successfully.",
    ...categories,
  });
}, SKILL_FAILURE);

export const deleteSkill = handle(async (req, res) => {
  const category = await skills.removeSkill(req.params.id, req.params.skillName);
  res.status(200).json({ success: true, message: "Skill deleted successfully.", category });
}, SKILL_FAILURE);
