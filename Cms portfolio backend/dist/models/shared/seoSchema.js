"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeoSchema = exports.SEO_FIELD_LIMITS = void 0;
const mongoose_1 = require("mongoose");
exports.SEO_FIELD_LIMITS = {
    metaTitle: 70,
    metaDescription: 160,
    ogImage: 500,
    canonicalUrl: 500,
};
exports.SeoSchema = new mongoose_1.Schema({
    metaTitle: {
        type: String,
        default: "",
        trim: true,
        maxlength: exports.SEO_FIELD_LIMITS.metaTitle,
    },
    metaDescription: {
        type: String,
        default: "",
        trim: true,
        maxlength: exports.SEO_FIELD_LIMITS.metaDescription,
    },
    ogImage: {
        type: String,
        default: "",
        trim: true,
        maxlength: exports.SEO_FIELD_LIMITS.ogImage,
    },
    canonicalUrl: {
        type: String,
        default: "",
        trim: true,
        maxlength: exports.SEO_FIELD_LIMITS.canonicalUrl,
    },
    noindex: {
        type: Boolean,
        default: false,
    },
    nofollow: {
        type: Boolean,
        default: false,
    },
}, {
    _id: false,
    id: false,
});
