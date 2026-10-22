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
exports.PageSeo = exports.SEO_PAGE_KEYS = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const seoSchema_1 = require("./shared/seoSchema");
/**
 * ─────────────────────────────────────────────────────────────────────────
 *  PageSeo — per-static-page SEO overrides
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  Pages that already own a content document (Home, About, Contact) store
 *  their SEO on that document. Pages that are pure listings or have no
 *  backing document (Services, Projects, Blog, Skills) have nowhere natural
 *  to live, so this singleton holds one record per page keyed by a stable
 *  `page` identifier — NOT a free-form path, so the set stays enumerable and
 *  cannot grow into an open redirect surface.
 *
 *  Known page keys mirror the public route tree:
 *    home | about | skills | services | projects | blog | contact
 */
exports.SEO_PAGE_KEYS = [
    "home",
    "about",
    "skills",
    "services",
    "projects",
    "blog",
    "contact",
];
const PageSeoSchema = new mongoose_1.Schema({
    page: {
        type: String,
        required: true,
        enum: exports.SEO_PAGE_KEYS,
        unique: true,
    },
    seo: {
        type: seoSchema_1.SeoSchema,
        default: () => ({}),
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        versionKey: false,
        transform: (_doc, ret) => {
            const { _id, __v, ...rest } = ret;
            return { ...rest, id: _id.toString() };
        },
    },
    toObject: {
        virtuals: true,
        versionKey: false,
        transform: (_doc, ret) => {
            const { _id, __v, ...rest } = ret;
            return { ...rest, id: _id.toString() };
        },
    },
});
exports.PageSeo = mongoose_1.default.models.PageSeo ||
    mongoose_1.default.model("PageSeo", PageSeoSchema);
