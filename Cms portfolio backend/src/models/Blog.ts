import mongoose, { Document, Schema } from "mongoose";

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


export const Blog = mongoose.model<IBlog>("Blog", BlogSchema);
