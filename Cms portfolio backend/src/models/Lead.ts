import mongoose, { Document, Schema } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
//  Lead — the person behind one or more contact-form messages.
//
//  The inbox is grouped by person, keyed on the normalized email address.
//  Every submission links to a Lead so we can show one timeline per person
//  instead of isolated rows. Counts + timestamps only (by design).
//
//  NOTE: named "Lead" (collection "leads") to avoid colliding with the
//  existing Contact model (collection "contacts"), which stores the contact
//  page's info + FAQ. Additive: this does not touch that document.
// ─────────────────────────────────────────────────────────────────────────────

export interface ILead extends Document {
  email: string;
  name: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  lastMessageAt: Date;
  messageCount: number;
  unreadCount: number;
  replyCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },
    name: { type: String, default: "", trim: true, maxlength: 160 },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    lastMessageAt: { type: Date, default: Date.now },
    messageCount: { type: Number, default: 0 },
    unreadCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
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

LeadSchema.index({ lastMessageAt: -1 });

export const Lead =
  mongoose.models.Lead || mongoose.model<ILead>("Lead", LeadSchema);
