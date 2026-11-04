import mongoose, { Document, Schema } from "mongoose";
import { SeoSchema, type ISeo } from "./shared/seoSchema";

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

  /**
   * Optional public URL segment. Legacy projects have no slug; the public
   * detail route resolves them by id as a fallback (see getProjectBySlug).
   * `sparse: true` keeps the unique index from rejecting documents that
   * predate slugs.
   */
  slug?: string;

  seo?: ISeo;
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

    // Optional, additive. Legacy projects keep working without a slug/seo.
    slug: {
      type: String,
      default: undefined,
      trim: true,
      lowercase: true,
      index: { unique: true, sparse: true },
    },

    seo: {
      type: SeoSchema,
      default: undefined,
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

/**
 * Indexes for the dashboard list endpoint (`GET /api/projects/all`).
 *
 *  { category, createdAt } — filter + sort satisfied by one index
 *  { createdAt }            — the unfiltered listing (newest first)
 *  { title } / { tags }     — the search path
 *  { featured }             — the "featured" stat card count
 */
ProjectSchema.index({ category: 1, createdAt: -1 });
ProjectSchema.index({ createdAt: -1 });
ProjectSchema.index({ title: 1 });
ProjectSchema.index({ tags: 1 });
ProjectSchema.index({ featured: 1 });

export const Project = mongoose.model<IProject>("Project", ProjectSchema);
