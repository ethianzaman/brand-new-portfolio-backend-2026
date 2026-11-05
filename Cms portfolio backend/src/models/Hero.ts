import { Schema, model } from "mongoose";

const SocialSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 50 },
    href: { type: String, required: true, trim: true, maxlength: 500 },
    icon: { type: String, default: "", trim: true, maxlength: 30 },
  },
  { _id: true },
);

const StatsSchema = new Schema(
  {
    value: { type: String, required: true, trim: true, maxlength: 50 },
    label: { type: String, required: true, trim: true, maxlength: 100 },
  },
  { _id: true },
);

const heroSchema = new Schema(
  {
    hero: {
      name: { type: String, default: "Your Name", trim: true, maxlength: 100 },
      title: {
        type: String,
        default: "Full Stack Developer",
        trim: true,
        maxlength: 200,
      },
      titles: {
        type: [String],
        default: [],
        validate: {
          validator: (arr: string[]) => arr.length <= 30,
          message: "Maximum 30 titles allowed",
        },
      },
      bio: { type: String, default: "Your bio here.", trim: true },
      image: { type: String, default: null },
      resumeUrl: { type: String, default: "/resume.pdf" },
      socials: { type: [SocialSchema], default: [] },
    },
    stats: { type: [StatsSchema], default: [] },
  },
  { timestamps: true },
);

// The collection keeps its original name, so the saved data stays where it is.
export const Hero = model("Hero", heroSchema, "homeheros");

export const DEFAULT_HERO = {
  name: "Your Name",
  title: "Full Stack Developer",
  titles: [],
  bio: "Your bio here.",
  image: null,
  resumeUrl: "/resume.pdf",
  socials: [],
  stats: [],
};