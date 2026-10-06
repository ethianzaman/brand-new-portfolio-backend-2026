"use strict";
// import mongoose, { Schema, model } from "mongoose";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_HOME_HERO = exports.HomeHero = void 0;
// const SocialSchema = new Schema(
//   {
//     label: { type: String, required: true, trim: true, maxlength: 50 },
//     href: { type: String, required: true, trim: true, maxlength: 500 },
//   },
//   { _id: true },
// );
// const StatsSchema = new Schema(
//   {
//     value: { type: String, required: true, trim: true, maxlength: 50 },
//     label: { type: String, required: true, trim: true, maxlength: 100 },
//   },
//   { _id: true },
// );
// const homeHeroSchema = new Schema(
//   {
//     hero: {
//       name: { type: String, default: "Your Name", trim: true, maxlength: 100 },
//       title: {
//         type: String,
//         default: "Full Stack Developer",
//         trim: true,
//         maxlength: 200,
//       },
//       titles: {
//         type: [String],
//         default: [
//           "Django & Next.js Specialist",
//           "Schema & DB Architect",
//           "System Design Enthusiast",
//           "Full Stack Web Engineer",
//         ],
//         validate: {
//           validator: (arr: string[]) => arr.length <= 30,
//           message: "Maximum 30 titles allowed",
//         },
//       },
//       bio: { type: String, default: "Your bio here.", trim: true },
//       image: { type: String, default: null },
//       resumeUrl: { type: String, default: "/resume.pdf" },
//       socials: { type: [SocialSchema], default: [] },
//     },
//     stats: { type: [StatsSchema], default: [] },
//   },
//   { timestamps: true },
// );
// export const HomeHero = model("HomeHero", homeHeroSchema);
// export const DEFAULT_HOME_HERO = {
//   name: "Your Name",
//   title: "Full Stack Developer",
//   titles: [
//     "Django & Next.js Specialist",
//     "Schema & DB Architect",
//     "System Design Enthusiast",
//     "Full Stack Web Engineer",
//   ],
//   bio: "Your bio here.",
//   image: null,
//   resumeUrl: "/resume.pdf",
//   socials: [],
//   stats: [],
// };
const mongoose_1 = require("mongoose");
const SocialSchema = new mongoose_1.Schema({
    label: { type: String, required: true, trim: true, maxlength: 50 },
    href: { type: String, required: true, trim: true, maxlength: 500 },
}, { _id: true });
const StatsSchema = new mongoose_1.Schema({
    value: { type: String, required: true, trim: true, maxlength: 50 },
    label: { type: String, required: true, trim: true, maxlength: 100 },
}, { _id: true });
const homeHeroSchema = new mongoose_1.Schema({
    hero: {
        name: { type: String, default: "Your Name", trim: true, maxlength: 100 },
        title: {
            type: String,
            default: "Full Stack Developer",
            trim: true,
            maxlength: 200,
        },
        titles: {
            type: [String],
            default: [],
            validate: {
                validator: (arr) => arr.length <= 30,
                message: "Maximum 30 titles allowed",
            },
        },
        bio: { type: String, default: "Your bio here.", trim: true },
        image: { type: String, default: null },
        resumeUrl: { type: String, default: "/resume.pdf" },
        socials: { type: [SocialSchema], default: [] },
    },
    stats: { type: [StatsSchema], default: [] },
}, { timestamps: true });
exports.HomeHero = (0, mongoose_1.model)("HomeHero", homeHeroSchema);
exports.DEFAULT_HOME_HERO = {
    name: "Your Name",
    title: "Full Stack Developer",
    titles: [],
    bio: "Your bio here.",
    image: null,
    resumeUrl: "/resume.pdf",
    socials: [],
    stats: [],
};
