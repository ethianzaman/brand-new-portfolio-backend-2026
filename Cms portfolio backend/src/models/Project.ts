import mongoose, { Document, Schema } from 'mongoose'

// Matches your frontend Project type exactly
export interface IProject extends Document {
  title:       string
  description: string
  category:    'frontend' | 'fullstack' | 'backend' | 'mobile'
  tags:        string[]
  liveUrl:     string
  githubUrl:   string
  color:       string
  thumbnail?:  string
  featured:    boolean
  isPlaceholder?: boolean
}

const ProjectSchema = new Schema<IProject>(
  {
    title:         { type: String, required: true, trim: true },
    description:   { type: String, required: true },
    category:      {
      type:     String,
      required: true,
      enum:     ['frontend', 'fullstack', 'backend', 'mobile'],
    },
    tags:          [{ type: String }],
    liveUrl:       { type: String, default: '#' },
    githubUrl:     { type: String, default: '#' },
    color:         { type: String, default: '#6366f1' },
    thumbnail:     { type: String },
    featured:      { type: Boolean, default: false },
    isPlaceholder: { type: Boolean, default: false },
  },
  { timestamps: true }
)

export const Project = mongoose.model<IProject>('Project', ProjectSchema)