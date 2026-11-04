import mongoose, { Document, Schema } from "mongoose";
import { SeoSchema, type ISeo } from "./shared/seoSchema";

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  PageSeo — per-static-page SEO overrides
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  Pages that already own a content document (Home, About, Contact) store
 *  their SEO on that document. Pages that are pure listings or have no
 *  backing document (Services, Projects, Blog, Skills) have nowhere natural
 *  to live, so this singleton holds one record per page keyed by a stable
 *  `page` identifier — NOT a free-form path, so the set stays enumerable and
 *  cannot grow into an open redirect surface.
 *
 *  Known page keys mirror the public route tree:
 *    home | about | skills | services | projects | blog | contact
 */

export const SEO_PAGE_KEYS = [
  "home",
  "about",
  "skills",
  "services",
  "projects",
  "blog",
  "contact",
] as const;

export type SeoPageKey = (typeof SEO_PAGE_KEYS)[number];

export interface IPageSeo extends Document {
  page: SeoPageKey;
  seo: ISeo;
}

const PageSeoSchema = new Schema<IPageSeo>(
  {
    page: {
      type: String,
      required: true,
      enum: SEO_PAGE_KEYS,
      unique: true,
    },
    seo: {
      type: SeoSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: any) => {
        const { _id, __v, ...rest } = ret;
        return { ...rest, id: _id.toString() };
      },
    },

    toObject: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: any) => {
        const { _id, __v, ...rest } = ret;
        return { ...rest, id: _id.toString() };
      },
    },
  },
);

export const PageSeo =
  mongoose.models.PageSeo ||
  mongoose.model<IPageSeo>("PageSeo", PageSeoSchema);
