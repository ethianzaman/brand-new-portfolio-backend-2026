import mongoose, { Document, Schema, Types } from "mongoose";

export interface IValue {
  _id: Types.ObjectId;
  icon: string;
  title: string;
  desc: string;
}

export interface IExperience {
  _id: Types.ObjectId;
  role: string;
  company: string;
  type: string;
  period: string;
  current: boolean;
  description: string;
  tags: string[];
}

export interface IEducation {
  _id: Types.ObjectId;
  degree: string;
  school: string;
  period: string;
  description: string;
  grade?: string;
}

export interface IAbout extends Document {
  hero: {
    name: string;
    title: string;
    subtitle: string;
    bio: string[];
    image: string | null;
    resumeUrl: string;
    location: string;
    experience: string;
  };
  experiences: Types.DocumentArray<IExperience>; // ✅ DocumentArray
  educations: Types.DocumentArray<IEducation>; // ✅ DocumentArray
  values: Types.DocumentArray<IValue>; // ✅ DocumentArray
}

const valueSchema = new Schema<IValue>({
  icon: { type: String, required: true },
  title: { type: String, required: true },
  desc: { type: String, required: true },
});

const experienceSchema = new Schema<IExperience>({
  role: { type: String, required: true },
  company: { type: String, required: true },
  type: { type: String, default: "" },
  period: { type: String, default: "" },
  current: { type: Boolean, default: false },
  description: { type: String, default: "" },
  tags: [{ type: String }],
});

const educationSchema = new Schema<IEducation>({
  degree: { type: String, required: true },
  school: { type: String, required: true },
  period: { type: String, default: "" },
  description: { type: String, default: "" },
  grade: { type: String },
});

const AboutSchema = new Schema<IAbout>(
  {
    hero: {
      name: { type: String, required: true },
      title: { type: String, required: true },
      subtitle: { type: String, default: "" },
      bio: [{ type: String }],
      image: { type: String, default: null },
      resumeUrl: { type: String, default: "/resume.pdf" },
      location: { type: String, default: "Remote" },
      experience: { type: String, default: "1+ Year" },
    },
    experiences: [experienceSchema],
    educations: [educationSchema], // ✅
    values: [valueSchema], // ✅
  },
  { timestamps: true },
);

export const About =
  mongoose.models.About ?? mongoose.model<IAbout>("About", AboutSchema);
