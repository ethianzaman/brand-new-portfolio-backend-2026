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
exports.Service = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const seoSchema_1 = require("./shared/seoSchema");
const ServiceSchema = new mongoose_1.Schema({
    icon: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    features: [{ text: { type: String, required: true } }],
    tags: [{ type: String }],
    color: { type: String, default: "#6366f1" },
    popular: { type: Boolean, default: false },
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
        versionKey: false,
        transform: (_doc, ret) => {
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
        transform: (_doc, ret) => {
            const { _id, ...rest } = ret;
            return {
                id: _id.toString(),
                ...rest,
            };
        },
    },
});
/**
 * Indexes for the list endpoint (`GET /api/services`).
 *
 *  { createdAt }   — the default listing (oldest first)
 *  { title }       — the search path
 *  { tags }        — the search path
 *  { popular }     — the "popular" stat card count
 */
ServiceSchema.index({ createdAt: 1 });
ServiceSchema.index({ title: 1 });
ServiceSchema.index({ tags: 1 });
ServiceSchema.index({ popular: 1 });
// export const Service = mongoose.model<IService>("Service", ServiceSchema);
exports.Service = mongoose_1.default.models.Service || mongoose_1.default.model("Service", ServiceSchema);
