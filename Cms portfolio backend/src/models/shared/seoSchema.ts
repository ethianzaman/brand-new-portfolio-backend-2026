import { Schema } from "mongoose";

/**
 * Shared optional SEO subdocument.
 *
 * Deliberately a single reusable schema so Blog, Project, Service, the global
 * SiteSettings and every static-page SEO record all expose the exact same
 * shape — the frontend resolver then has one contract to reason about.
 *
 * Every field is optional and defaults to an empty/false value, so documents
 * written before this feature keep working without a migration: an absent
 * `seo` subdocument simply reads back as the neutral shape via
 * `serializeSeo()`.
 */

export interface ISeo {
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  canonicalUrl: string;
  noindex: boolean;
  nofollow: boolean;
}

export const SEO_FIELD_LIMITS = {
  metaTitle: 70,
  metaDescription: 160,
  ogImage: 500,
  canonicalUrl: 500,
} as const;

export const SeoSchema = new Schema<ISeo>(
  {
    metaTitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: SEO_FIELD_LIMITS.metaTitle,
    },
    metaDescription: {
      type: String,
      default: "",
      trim: true,
      maxlength: SEO_FIELD_LIMITS.metaDescription,
    },
    ogImage: {
      type: String,
      default: "",
      trim: true,
      maxlength: SEO_FIELD_LIMITS.ogImage,
    },
    canonicalUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: SEO_FIELD_LIMITS.canonicalUrl,
    },
    noindex: {
      type: Boolean,
      default: false,
    },
    nofollow: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
    id: false,
  },
);
