import mongoose, { Document, Schema } from "mongoose";

export interface IService extends Document {
  icon: string;
  title: string;
  description: string;
  features: { text: string }[];
  tags: string[];
  color: string;
  popular: boolean;
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

// export const Service = mongoose.model<IService>("Service", ServiceSchema);
export const Service =
  mongoose.models.Service || mongoose.model<IService>("Service", ServiceSchema);
