import mongoose, { Schema, model } from "mongoose";

const SkillItemSchema = new Schema({
  name: String,
});

const SkillCategorySchema = new Schema({
  label: String,
  icon: String,
  items: [SkillItemSchema],
});

const StatsSchema = new Schema({
  value: String,
  label: String,
});

const SocialSchema = new Schema({
  href: String,
  label: String,
});

const homeHeroSchema = new Schema(
  {
    hero: {
      name: String,
      title: String,
      subtitle: String,
      workStatus: String,
      image: { type: String, default: null },
      resumeUrl: { type: String, default: "/resume.pdf" },
      video: { type: String, default: null },
    },

    about: {
      description: [String],
      location: String,
      experience: String,
    },

    skills: [SkillCategorySchema],

    stats: [StatsSchema],

    socials: [SocialSchema],
  },
  { timestamps: true },
);

export const HomeHero = model("HomeHero", homeHeroSchema);
