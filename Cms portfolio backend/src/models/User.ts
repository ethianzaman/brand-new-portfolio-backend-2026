import mongoose, { Document, Schema, Types } from 'mongoose'
import bcrypt from 'bcryptjs'

export const USER_ROLES = ['super_admin', 'admin', 'manager', 'editor'] as const

/** Super Admin always has everything, so only these roles have editable access. */
export const CONFIGURABLE_ROLES = ['admin', 'manager', 'editor'] as const

export type UserRole = (typeof USER_ROLES)[number]

export function isValidRole(value: unknown): value is UserRole {
  return (
    typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
  )
}

export interface IUser extends Document {
  _id: Types.ObjectId
  email: string
  password: string
  role: UserRole
  isActive: boolean
  /** Raised on logout, which invalidates every token issued before it. */
  tokenVersion: number
  createdAt: Date
  updatedAt: Date
  comparePassword: (plain: string) => Promise<boolean>
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      required: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as Record<string, unknown>).password
        delete (ret as Record<string, unknown>).__v
        ret.id = (ret._id as Types.ObjectId).toString()
        delete (ret as Record<string, unknown>)._id
        return ret
      },
    },
  }
)

// Hash password before save
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

// Defensive: hash password on update queries too (pre('save') does not run
// for findByIdAndUpdate / updateOne, so an unhashed password could otherwise
// be written straight to the database).
async function hashPasswordInUpdate(
  update: Record<string, unknown> | Record<string, unknown>[] | undefined
): Promise<void> {
  if (!update) return
  const ops = Array.isArray(update) ? update : [update]
  for (const op of ops) {
    if (op && typeof op.password === 'string' && op.password.length > 0) {
      op.password = await bcrypt.hash(op.password, 12)
    }
  }
}

UserSchema.pre('findOneAndUpdate', async function (next) {
  await hashPasswordInUpdate(this.getUpdate() as Record<string, unknown>)
  next()
})

UserSchema.pre('updateOne', async function (next) {
  await hashPasswordInUpdate(this.getUpdate() as Record<string, unknown>)
  next()
})

UserSchema.methods.comparePassword = function (
  plain: string
): Promise<boolean> {
  return bcrypt.compare(plain, this.password)
}

export const User = mongoose.model<IUser>('User', UserSchema)
