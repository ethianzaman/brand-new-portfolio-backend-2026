import mongoose, { Document, Schema } from "mongoose";
import { SeoSchema, type ISeo } from "./shared/seoSchema";

export interface IService extends Document {
  icon: string;
  title: string;
  description: string;
  features: { text: string }[];
  tags: string[];
  color: string;
  popular: boolean;
  /** Optional public URL segment (legacy services fall back to id). */
  slug?: string;
  seo?: ISeo;
}

const ServiceSchema = new Schema<IService>(
  {
    icon: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    features: [{ text: { type: String, required: true } }],
    tags: [{ type: String }],
    color: { type: String, default: "#6366f1" },
    popular: { type: Boolean, default: false },
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
      versionKey: false,
      transform: (_doc, ret: any) => {
        const { _id, ...rest } = ret;
        return {
          id: _id.toString(),
          ...rest,
        };
      },
    },

    toObject: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: any) => {
        const { _id, ...rest } = ret;
        return {
          id: _id.toString(),
          ...rest,
        };
      },
    },
  },
);

/**
 * Indexes for the list endpoint (`GET /api/services`).
 *
 *  { createdAt }   — the default listing (oldest first)
 *  { title }       — the search path
 *  { tags }        — the search path
 *  { popular }     — the "popular" stat card count
 */
ServiceSchema.index({ createdAt: 1 });
ServiceSchema.index({ title: 1 });
ServiceSchema.index({ tags: 1 });
ServiceSchema.index({ popular: 1 });

export const Service =
  mongoose.models.Service || mongoose.model<IService>("Service", ServiceSchema);
