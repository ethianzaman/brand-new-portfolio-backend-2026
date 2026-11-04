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
exports.SiteSettings = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SiteBrandLogoSchema = new mongoose_1.Schema({
    type: {
        type: String,
        enum: ["icon", "image"],
        default: "icon",
    },
    icon: {
        type: String,
        default: "zap",
        trim: true,
    },
    url: {
        type: String,
        default: "",
        trim: true,
    },
}, {
    _id: false,
    id: false,
});
const SiteSocialSchema = new mongoose_1.Schema({
    label: {
        type: String,
        default: "",
        trim: true,
    },
    href: {
        type: String,
        default: "",
        trim: true,
    },
    icon: {
        type: String,
        default: "link",
        trim: true,
    },
}, {
    _id: false,
    id: false,
});
const SiteSeoSchema = new mongoose_1.Schema({
    defaultMetaTitle: { type: String, default: "", trim: true, maxlength: 70 },
    defaultTitleTemplate: {
        type: String,
        default: "%s",
        trim: true,
        maxlength: 120,
    },
    defaultMetaDescription: {
        type: String,
        default: "",
        trim: true,
        maxlength: 160,
    },
    defaultOgImage: { type: String, default: "", trim: true, maxlength: 500 },
    twitterHandle: { type: String, default: "", trim: true, maxlength: 100 },
    siteUrl: { type: String, default: "", trim: true, maxlength: 300 },
}, {
    _id: false,
    id: false,
});
const SiteSettingsSchema = new mongoose_1.Schema({
    brand: {
        name: {
            type: String,
            default: "",
            trim: true,
        },
        tagline: {
            type: String,
            default: "",
            trim: true,
        },
        logo: {
            type: SiteBrandLogoSchema,
            default: () => ({}),
        },
    },
    socials: {
        type: [SiteSocialSchema],
        default: [],
    },
    seo: {
        type: SiteSeoSchema,
        default: undefined,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        versionKey: false,
        transform: (_doc, ret) => {
            const { _id, __v, ...rest } = ret;
            return {
                ...rest,
                id: _id.toString(),
            };
        },
    },
    toObject: {
        virtuals: true,
        versionKey: false,
        transform: (_doc, ret) => {
            const { _id, __v, ...rest } = ret;
            return {
                ...rest,
                id: _id.toString(),
            };
        },
    },
});
exports.SiteSettings = mongoose_1.default.models.SiteSettings ||
    mongoose_1.default.model("SiteSettings", SiteSettingsSchema);
