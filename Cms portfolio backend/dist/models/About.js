"use strict";
// import mongoose, { Document, Schema } from "mongoose";
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
exports.About = void 0;
// export interface IAbout extends Document {
//   hero: {
//     name: string;
//     title: string;
//     subtitle: string;
//     bio: string[];
//     image: string | null;
//     resumeUrl: string;
//     location: string;
//     experience: string;
//   };
//   experiences: {
//     _id: mongoose.Types.ObjectId; // ← add
//     role: string;
//     company: string;
//     type: string;
//     period: string;
//     current: boolean;
//     description: string;
//     tags: string[];
//   }[];
//   educations: {
//     _id: mongoose.Types.ObjectId; // ← add
//     degree: string;
//     school: string;
//     period: string;
//     description: string;
//     grade?: string;
//   }[];
//   values: {
//     _id: mongoose.Types.ObjectId; // ← add
//     icon: string;
//     title: string;
//     desc: string;
//   }[];
// }
// const AboutSchema = new Schema<IAbout>(
//   {
//     hero: {
//       name: { type: String, required: true },
//       title: { type: String, required: true },
//       subtitle: { type: String, default: "" },
//       bio: [{ type: String }],
//       image: { type: String, default: null },
//       resumeUrl: { type: String, default: "/resume.pdf" },
//       location: { type: String, default: "Remote" },
//       experience: { type: String, default: "1+ Year" },
//     },
//     experiences: [
//       {
//         // id: { type: String, required: true },
//         role: { type: String, required: true },
//         company: { type: String, required: true },
//         type: { type: String, default: "" },
//         period: { type: String, default: "" },
//         current: { type: Boolean, default: false },
//         description: { type: String, default: "" },
//         tags: [{ type: String }],
//       },
//     ],
//     educations: [
//       {
//         // id: { type: String, required: true },
//         degree: { type: String, required: true },
//         school: { type: String, required: true },
//         period: { type: String, default: "" },
//         description: { type: String, default: "" },
//         grade: { type: String },
//       },
//     ],
//     values: [
//       {
//         // id: { type: String, required: true },
//         icon: { type: String, required: true },
//         title: { type: String, required: true },
//         desc: { type: String, required: true },
//       },
//     ],
//   },
//   {
//     timestamps: true,
//   },
// );
// // export const About = mongoose.model<IAbout>("About", AboutSchema);
// export const About =
//   mongoose.models.About ?? mongoose.model<IAbout>("About", AboutSchema);
const mongoose_1 = __importStar(require("mongoose"));
// ✅ আলাদা Schema — এটাই TypeScript-কে type বোঝায়
const valueSchema = new mongoose_1.Schema({
    icon: { type: String, required: true },
    title: { type: String, required: true },
    desc: { type: String, required: true },
});
const experienceSchema = new mongoose_1.Schema({
    role: { type: String, required: true },
    company: { type: String, required: true },
    type: { type: String, default: "" },
    period: { type: String, default: "" },
    current: { type: Boolean, default: false },
    description: { type: String, default: "" },
    tags: [{ type: String }],
});
const educationSchema = new mongoose_1.Schema({
    degree: { type: String, required: true },
    school: { type: String, required: true },
    period: { type: String, default: "" },
    description: { type: String, default: "" },
    grade: { type: String },
});
const AboutSchema = new mongoose_1.Schema({
    hero: {
        name: { type: String, required: true },
        title: { type: String, required: true },
        subtitle: { type: String, default: "" },
        bio: [{ type: String }],
        image: { type: String, default: null },
        resumeUrl: { type: String, default: "/resume.pdf" },
        location: { type: String, default: "Remote" },
        experience: { type: String, default: "1+ Year" },
    },
    experiences: [experienceSchema], // ✅ inline object এর বদলে Schema
    educations: [educationSchema], // ✅
    values: [valueSchema], // ✅
}, { timestamps: true });
exports.About = mongoose_1.default.models.About ?? mongoose_1.default.model("About", AboutSchema);
