import { handle, WRITE_FAILURE } from "../lib/http";
import * as about from "../services/about.service";
import type { AboutFiles } from "../services/about.service";

const SHOW_SAFE_MESSAGE = { status: 500, message: "Server error" };

export const getAbout = handle(async (_req, res) => {
  res.status(200).json({ success: true, about: await about.getAbout() });
});

export const updateHero = handle(
  async (req, res) => {
    const hero = await about.updateHero(req.body, req.files as AboutFiles | undefined);
    res.status(200).json({ success: true, hero });
  },
  { status: 500, message: "Internal server error" },
);

// ── Experiences ───────────────────────────────────────────────────────
export const createExperience = handle(async (req, res) => {
  const { experience, allExperiences } = await about.addExperience(req.body);
  res.status(201).json({
    success: true,
    message: "Experience created successfully",
    experience,
    allExperiences,
  });
}, WRITE_FAILURE);

export const updateExperience = handle(async (req, res) => {
  const experience = await about.editExperience(req.params.id, req.body);
  res.status(200).json({ success: true, message: "Experience updated successfully", experience });
});

export const deleteExperience = handle(async (req, res) => {
  await about.removeExperience(req.params.id);
  res.status(200).json({ success: true, message: "Experience deleted successfully" });
});

// ── Educations ────────────────────────────────────────────────────────
export const createEducation = handle(async (req, res) => {
  res.status(201).json({ success: true, education: await about.addEducation(req.body) });
}, WRITE_FAILURE);

export const updateEducation = handle(async (req, res) => {
  const education = await about.editEducation(req.params.id, req.body);
  res.status(200).json({ success: true, message: "Education updated successfully", education });
});

export const deleteEducation = handle(async (req, res) => {
  await about.removeEducation(req.params.id);
  res.status(200).json({ success: true, message: "Education deleted successfully" });
});

// ── Values ────────────────────────────────────────────────────────────
export const createValue = handle(async (req, res) => {
  const value = await about.addValue(req.body);
  res.status(201).json({ success: true, message: "Value created successfully", value });
}, WRITE_FAILURE);

export const updateValue = handle(async (req, res) => {
  res.status(200).json({ success: true, value: await about.editValue(req.params.id, req.body) });
}, SHOW_SAFE_MESSAGE);

export const deleteValue = handle(async (req, res) => {
  await about.removeValue(req.params.id);
  res.status(200).json({ success: true, message: "Value deleted successfully" });
}, SHOW_SAFE_MESSAGE);
