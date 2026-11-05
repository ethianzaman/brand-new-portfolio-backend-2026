import mongoose, { Document, Schema } from "mongoose";

/** What one role may do. Absent until a Super Admin first saves that role. */
export interface IRolePermission extends Document {
  role: string;
  permissions: string[];
}

const RolePermissionSchema = new Schema<IRolePermission>(
  {
    role: { type: String, required: true, unique: true, trim: true },
    permissions: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const RolePermission =
  mongoose.models.RolePermission ||
  mongoose.model<IRolePermission>("RolePermission", RolePermissionSchema);
