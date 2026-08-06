// import mongoose, { Document, Schema } from 'mongoose'

// // Matches your frontend Project type exactly
// export interface IProject extends Document {
//   title:       string
//   description: string
//   category:    'frontend' | 'fullstack' | 'backend' | 'mobile'
//   tags:        string[]
//   liveUrl:     string
//   githubUrl:   string
//   color:       string
//   thumbnail?:  string
//   featured:    boolean
//   isPlaceholder?: boolean
// }

// const ProjectSchema = new Schema<IProject>(
//   {
//     title:         { type: String, required: true, trim: true },
//     description:   { type: String, required: true },
//     category:      {
//       type:     String,
//       required: true,
//       enum:     ['frontend', 'fullstack', 'backend', 'mobile'],
//     },
//     tags:          [{ type: String }],
//     liveUrl:       { type: String, default: '#' },
//     githubUrl:     { type: String, default: '#' },
//     color:         { type: String, default: '#6366f1' },
//     thumbnail:     { type: String },
//     featured:      { type: Boolean, default: false },
//     isPlaceholder: { type: Boolean, default: false },
//   },
//   { timestamps: true }
// )

// export const Project = mongoose.model<IProject>('Project', ProjectSchema)

import mongoose, { Document, Schema } from "mongoose";

function transformDocument(_: unknown, ret: Record<string, any>) {
  ret.id = ret._id.toString();

  delete ret._id;
  delete ret.__v;

  return ret;
}

// Matches frontend Project type
export interface IProject extends Document {
  title: string;
  description: string;

  category: "frontend" | "fullstack" | "backend" | "mobile" | "devops" | "ai";

  tags: string[];

  liveUrl: string;

  githubUrl: string;

  color: string;

  thumbnail?: string;

  featured: boolean;

  isPlaceholder: boolean;
}

const ProjectSchema = new Schema<IProject>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      enum: ["frontend", "fullstack", "backend", "mobile", "devops", "ai"],
    },

    tags: [
      {
        type: String,
        trim: true,
      },
    ],

    liveUrl: {
      type: String,
      default: "#",
    },

    githubUrl: {
      type: String,
      default: "#",
    },

    color: {
      type: String,
      default: "#6366f1",
    },

    thumbnail: {
      type: String,
      default: "",
    },

    featured: {
      type: Boolean,
      default: false,
    },

    isPlaceholder: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,
      transform: transformDocument,
    },

    toObject: {
      virtuals: true,
      transform: transformDocument,
    },
  },
);

export const Project = mongoose.model<IProject>("Project", ProjectSchema);
