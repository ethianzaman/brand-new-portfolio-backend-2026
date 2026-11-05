import mongoose, { Document, Schema } from 'mongoose'

interface ISkill {
  name: string
  icon: string
}

export interface ISkillCategory extends Document {
  label: string
  order: number
  skills: ISkill[]
}

const SkillItemSchema = new Schema<ISkill>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    icon: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  }
)

const SkillCategorySchema = new Schema<ISkillCategory>(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },

    order: {
      type: Number,
      default: 0,
    },

    skills: {
      type: [SkillItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,

      transform: (_doc, ret) => {
        const { _id, __v, ...rest } = ret

        return {
          ...rest,
          id: _id.toString(),
        }
      },
    },

    toObject: {
      virtuals: true,
    },
  }
)

export const SkillCategory =
  mongoose.models.SkillCategory ||
  mongoose.model<ISkillCategory>(
    'Skills',
    SkillCategorySchema
  )