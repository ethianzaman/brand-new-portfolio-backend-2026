import mongoose, { Document, Schema } from "mongoose";
import { SeoSchema, type ISeo } from "./shared/seoSchema";

function transformDocument(_: unknown, ret: Record<string, any>) {
  ret.id = ret._id.toString();

  delete ret._id;
  delete ret.__v;

  return ret;
}

// Matches frontend Blog type
export interface IBlog extends Document {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  tags: string[];
  category: string;
  author: string;
  readTime: number;
  status: "draft" | "published";
  featured: boolean;
  seo?: ISeo;
}

const BlogSchema = new Schema<IBlog>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    excerpt: {
      type: String,
      default: "",
    },

    content: {
      type: String,
      required: true,
      trim: true,
    },

    coverImage: {
      type: String,
      default: "",
    },

    tags: [
      {
        type: String,
        trim: true,
      },
    ],

    category: {
      type: String,
      default: "general",
    },

    author: {
      type: String,
      default: "Admin",
    },

    readTime: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
    },

    featured: {
      type: Boolean,
      default: false,
    },

    // Optional, additive SEO overrides. Absent on legacy documents.
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
 * Indexes for the dashboard list endpoint (`GET /api/blogs/all`).
 *
 * The list query is always `filter → sort(createdAt) → skip → limit`, so the
 * compound indexes below let MongoDB satisfy the filter AND the sort from a
 * single index instead of sorting the whole collection in memory.
 *
 *  { status, createdAt }  — the default listing (drafts + published, newest first)
 *  { category, createdAt }— the same listing narrowed to one category
 *  { title } / { tags }    — the search path (regex is matched against the index)
 *  { featured }           — the "featured" stat card count
 */
BlogSchema.index({ status: 1, createdAt: -1 });
BlogSchema.index({ category: 1, createdAt: -1 });
BlogSchema.index({ createdAt: -1 });
BlogSchema.index({ title: 1 });
BlogSchema.index({ tags: 1 });
BlogSchema.index({ featured: 1 });

export const Blog = mongoose.model<IBlog>("Blog", BlogSchema);
