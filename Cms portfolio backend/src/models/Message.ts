import mongoose, { Document, Schema } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
//  Message — a contact-form inquiry stored like an email thread.
//
//  This model is intentionally self-contained and additive: it does not touch
//  the existing Contact (info + FAQ) document, so the public contact page and
//  the existing contact CMS keep behaving exactly as before.
// ─────────────────────────────────────────────────────────────────────────────

export interface IMessageReply extends Document {
  body: string;
  sentAt: Date;
}

export interface IMessage extends Document {
  name: string;
  email: string;
  subject: string;
  budget: string;
  body: string;
  status: "unread" | "read";
  starred: boolean;
  replied: boolean;
  replies: IMessageReply[];
  lead?: mongoose.Types.ObjectId | null;
  idempotencyKey?: string;
  bodyHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReplySchema = new Schema(
  {
    body: { type: String, required: true, trim: true },
    sentAt: { type: Date, default: Date.now },
  },
  {
    _id: true,
    id: false,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: any) => {
        const { _id, __v, ...rest } = ret;
        return { id: _id.toString(), ...rest };
      },
    },
  },
);

const MessageSchema = new Schema<IMessage>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },
    subject: { type: String, default: "General Inquiry", trim: true },
    budget: { type: String, default: "", trim: true },
    body: { type: String, required: true, trim: true, maxlength: 8000 },
    status: {
      type: String,
      enum: ["unread", "read"],
      default: "unread",
      index: true,
    },
    starred: { type: Boolean, default: false },
    replied: { type: Boolean, default: false },
    replies: { type: [ReplySchema], default: [] },
    lead: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
      index: true,
    },
    idempotencyKey: { type: String, default: undefined },
    bodyHash: { type: String, default: undefined },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: any) => {
        const { _id, __v, ...rest } = ret;
        return { id: _id.toString(), ...rest };
      },
    },
    toObject: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: any) => {
        const { _id, __v, ...rest } = ret;
        return { id: _id.toString(), ...rest };
      },
    },
  },
);

MessageSchema.index({ createdAt: -1 });
MessageSchema.index({ lead: 1, createdAt: -1 });
MessageSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
MessageSchema.index({ email: 1, bodyHash: 1, createdAt: -1 });

export const Message =
  mongoose.models.Message ||
  mongoose.model<IMessage>("Message", MessageSchema);
