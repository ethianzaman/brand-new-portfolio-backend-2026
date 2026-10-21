import mongoose, { Document, Schema } from "mongoose";

/**
 * Global Site Settings — the ONE shared document behind the brand identity
 * (name + logo/icon) that both the Navbar and the Footer render.
 *
 * Navbar-specific data (navigation links, socials, CTA) and Footer-specific
 * data (bio, contact info, quick links, stack, copyright) deliberately stay
 * out of this document — only the genuinely shared brand values live here.
 */

export type SiteLogoType = "icon" | "image";

export interface ISiteBrandLogo {
  type: SiteLogoType;
  /** Icon key rendered when `type === "icon"` (see frontend BrandMark map). */
  icon: string;
  /** Image URL rendered when `type === "image"`. */
  url: string;
}

export interface ISiteSocial {
  label: string;
  href: string;
  /** Icon key rendered by the frontend `SocialIcon` map. */
  icon: string;
}

export interface ISiteSettings extends Document {
  brand: {
    name: string;
    tagline: string;
    logo: ISiteBrandLogo;
  };
  /**
   * Shared social links shown by BOTH the Navbar and the Footer. Owned here so
   * they are never duplicated per-section. The whole array is replaced on save.
   */
  socials: ISiteSocial[];
}

const SiteBrandLogoSchema = new Schema<ISiteBrandLogo>(
  {
    type: {
      type: String,
      enum: ["icon", "image"],
      default: "icon",
    },
    icon: {
      type: String,
      default: "zap",
      trim: true,
    },
    url: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    _id: false,
    id: false,
  },
);

const SiteSocialSchema = new Schema<ISiteSocial>(
  {
    label: {
      type: String,
      default: "",
      trim: true,
    },
    href: {
      type: String,
      default: "",
      trim: true,
    },
    icon: {
      type: String,
      default: "link",
      trim: true,
    },
  },
  {
    _id: false,
    id: false,
  },
);

const SiteSettingsSchema = new Schema<ISiteSettings>(
  {
    brand: {
      name: {
        type: String,
        default: "",
        trim: true,
      },
      tagline: {
        type: String,
        default: "",
        trim: true,
      },
      logo: {
        type: SiteBrandLogoSchema,
        default: () => ({}),
      },
    },
    socials: {
      type: [SiteSocialSchema],
      default: [],
    },
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: any) => {
        const { _id, __v, ...rest } = ret;

        return {
          ...rest,
          id: _id.toString(),
        };
      },
    },

    toObject: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: any) => {
        const { _id, __v, ...rest } = ret;

        return {
          ...rest,
          id: _id.toString(),
        };
      },
    },
  },
);

export const SiteSettings =
  mongoose.models.SiteSettings ||
  mongoose.model<ISiteSettings>("SiteSettings", SiteSettingsSchema);
