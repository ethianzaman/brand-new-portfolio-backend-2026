"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Project = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const seoSchema_1 = require("./shared/seoSchema");
function transformDocument(_, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
}
const ProjectSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    category: {
        type: String,
        required: true,
        enum: ["frontend", "fullstack", "backend", "mobile", "devops", "ai"],
    },
    tags: [
        {
            type: String,
            trim: true,
        },
    ],
    liveUrl: {
        type: String,
        default: "#",
    },
    githubUrl: {
        type: String,
        default: "#",
    },
    color: {
        type: String,
        default: "#6366f1",
    },
    thumbnail: {
        type: String,
        default: "",
    },
    featured: {
        type: Boolean,
        default: false,
    },
    isPlaceholder: {
        type: Boolean,
        default: false,
    },
    // Optional, additive. Legacy projects keep working without a slug/seo.
    slug: {
        type: String,
        default: undefined,
        trim: true,
        lowercase: true,
        index: { unique: true, sparse: true },
    },
    seo: {
        type: seoSchema_1.SeoSchema,
        default: undefined,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: transformDocument,
    },
    toObject: {
        virtuals: true,
        transform: transformDocument,
    },
});
/**
 * Indexes for the dashboard list endpoint (`GET /api/projects/all`).
 *
 *  { category, createdAt } — filter + sort satisfied by one index
 *  { createdAt }            — the unfiltered listing (newest first)
 *  { title } / { tags }     — the search path
 *  { featured }             — the "featured" stat card count
 */
ProjectSchema.index({ category: 1, createdAt: -1 });
ProjectSchema.index({ createdAt: -1 });
ProjectSchema.index({ title: 1 });
ProjectSchema.index({ tags: 1 });
ProjectSchema.index({ featured: 1 });
exports.Project = mongoose_1.default.model("Project", ProjectSchema);
