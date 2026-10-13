"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHome = getHome;
exports.updateHero = updateHero;
exports.replaceStats = replaceStats;
exports.createStat = createStat;
exports.updateStat = updateStat;
exports.deleteStat = deleteStat;
exports.createSocial = createSocial;
exports.updateSocial = updateSocial;
exports.deleteSocial = deleteSocial;
exports.sendDoc = sendDoc;
const mongoose_1 = __importDefault(require("mongoose"));
const homeHero_1 = require("../models/homeHero");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const cache_1 = require("../utils/cache");
const publish_1 = require("../lib/publish");
const CACHE_KEY = "home:data";
const MAX_SOCIALS = 20;
const MAX_STATS = 12;
const MAX_TITLES = 30;
// ── Helpers ─────────────────────────────────────────────────────
async function getOrCreateDoc() {
    let doc = await homeHero_1.HomeHero.findOne();
    if (!doc) {
        doc = await homeHero_1.HomeHero.create({
            hero: {
                name: homeHero_1.DEFAULT_HOME_HERO.name,
                title: homeHero_1.DEFAULT_HOME_HERO.title,
                titles: homeHero_1.DEFAULT_HOME_HERO.titles,
                bio: homeHero_1.DEFAULT_HOME_HERO.bio,
                image: homeHero_1.DEFAULT_HOME_HERO.image,
                resumeUrl: homeHero_1.DEFAULT_HOME_HERO.resumeUrl,
                socials: [],
            },
            stats: [],
        });
    }
    return doc;
}
function parseSocials(raw) {
    let list = raw;
    // FormData থেকে আসা JSON string কে parse করা
    if (typeof raw === "string") {
        try {
            list = JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    if (!Array.isArray(list))
        return null;
    const socials = [];
    for (const item of list) {
        if (item &&
            typeof item === "object" &&
            typeof item.label === "string" &&
            typeof item.href === "string") {
            const label = item.label.trim();
            const href = item.href.trim();
            if (label && href)
                socials.push({ label, href });
        }
    }
    return socials;
}
function parseTitles(raw) {
    let list = raw;
    // FormData থেকে আসা JSON string কে parse করা
    if (typeof raw === "string") {
        try {
            list = JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    if (!Array.isArray(list))
        return null;
    const titles = [];
    for (const item of list) {
        if (typeof item === "string" && item.trim()) {
            titles.push(item.trim());
        }
    }
    return titles;
}
function isValidUrl(url) {
    return /^(https?:\/\/|mailto:|tel:|#|\/)/.test(url);
}
function sendDoc(res, doc) {
    const home = {
        hero: {
            name: doc.hero.name,
            title: doc.hero.title,
            titles: doc.hero.titles,
            bio: doc.hero.bio,
            image: doc.hero.image,
            resumeUrl: doc.hero.resumeUrl,
            socials: doc.hero.socials.map((s) => ({
                _id: s._id,
                label: s.label,
                href: s.href,
            })),
        },
        stats: doc.stats.map((s) => ({
            _id: s._id,
            value: s.value,
            label: s.label,
        })),
    };
    res.status(200).json({ success: true, home });
}
function invalidate() {
    (0, cache_1.cacheDelete)(CACHE_KEY);
}
// ── GET /api/home — public (cached, fast) ───────────────────────
async function getHome(req, res) {
    try {
        // 1️⃣ Cache hit হলে DB hit ছাড়াই রেসপন্স
        const cached = (0, cache_1.cacheGet)(CACHE_KEY);
        if (cached) {
            res.status(200).json({ success: true, home: cached });
            return;
        }
        // 2️⃣ Cache miss → DB থেকে পড়া (প্রথমবার হলে default doc তৈরি)
        const doc = await getOrCreateDoc();
        const home = {
            hero: {
                name: doc.hero.name,
                title: doc.hero.title,
                titles: doc.hero.titles,
                bio: doc.hero.bio,
                image: doc.hero.image,
                resumeUrl: doc.hero.resumeUrl,
                socials: doc.hero.socials.map((s) => ({
                    _id: s._id,
                    label: s.label,
                    href: s.href,
                })),
            },
            stats: doc.stats.map((s) => ({
                _id: s._id,
                value: s.value,
                label: s.label,
            })),
        };
        (0, cache_1.cacheSet)(CACHE_KEY, home);
        res.status(200).json({ success: true, home });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
// ── PUT /api/home/hero — update hero (FormData) ─────────────────
async function updateHero(req, res) {
    try {
        const { name, title, bio, socials, titles, resumeUrl, } = req.body ?? {};
        const files = req.files;
        // ======================================================
        // 1. BASIC VALIDATION
        // ======================================================
        if (name !== undefined && !String(name).trim()) {
            res.status(400).json({
                success: false,
                message: "Name is required",
            });
            return;
        }
        if (title !== undefined && !String(title).trim()) {
            res.status(400).json({
                success: false,
                message: "Title is required",
            });
            return;
        }
        // ======================================================
        // 2. BUILD UPDATE FIELDS
        // ======================================================
        const updateFields = {};
        if (name !== undefined) {
            updateFields["hero.name"] = String(name)
                .trim()
                .slice(0, 100);
        }
        if (title !== undefined) {
            updateFields["hero.title"] = String(title)
                .trim()
                .slice(0, 200);
        }
        if (bio !== undefined) {
            updateFields["hero.bio"] = String(bio).trim();
        }
        // ======================================================
        // 3. SOCIALS
        // ======================================================
        if (socials !== undefined) {
            const parsedSocials = parseSocials(socials);
            if (!parsedSocials) {
                res.status(400).json({
                    success: false,
                    message: "socials must be a valid JSON array of { label, href }",
                });
                return;
            }
            if (parsedSocials.length > MAX_SOCIALS) {
                res.status(400).json({
                    success: false,
                    message: `Maximum ${MAX_SOCIALS} socials allowed`,
                });
                return;
            }
            for (const social of parsedSocials) {
                if (!isValidUrl(social.href)) {
                    res.status(400).json({
                        success: false,
                        message: `Invalid social href: ${social.href}`,
                    });
                    return;
                }
            }
            updateFields["hero.socials"] = parsedSocials;
        }
        // ======================================================
        // 4. TITLES
        // ======================================================
        if (titles !== undefined) {
            const parsedTitles = parseTitles(titles);
            if (!parsedTitles) {
                res.status(400).json({
                    success: false,
                    message: "titles must be a valid JSON array of strings",
                });
                return;
            }
            if (parsedTitles.length > MAX_TITLES) {
                res.status(400).json({
                    success: false,
                    message: `Maximum ${MAX_TITLES} titles allowed`,
                });
                return;
            }
            updateFields["hero.titles"] = parsedTitles.map((item) => item.slice(0, 100));
        }
        // ======================================================
        // 5. GET RESUME FILE
        // ======================================================
        const imageFile = files?.image?.[0];
        const resumeFile = files?.resume?.[0];
        // ======================================================
        // 6. GET OLD DOCUMENT
        // ======================================================
        const oldDoc = await getOrCreateDoc();
        const oldResumeUrl = oldDoc.hero.resumeUrl;
        if (imageFile) {
            if (!imageFile.mimetype.startsWith("image/")) {
                res.status(400).json({
                    success: false,
                    message: "Hero image must be an image file",
                });
                return;
            }
            const newImageUrl = await (0, uploadMiddleware_1.uploadToCloudinary)(imageFile.buffer, "portfolio_hero");
            updateFields["hero.image"] = newImageUrl;
        }
        // ======================================================
        // 7. RESUME / PDF
        // ======================================================
        if (resumeFile) {
            // -----------------------------------------------
            // PDF FILE UPLOAD
            // -----------------------------------------------
            if (resumeFile.mimetype !== "application/pdf") {
                res.status(400).json({
                    success: false,
                    message: "Resume must be a PDF file",
                });
                return;
            }
            const newResumeUrl = await (0, uploadMiddleware_1.uploadResumeToCloudinary)(resumeFile.buffer, "portfolio_resume");
            updateFields["hero.resumeUrl"] = newResumeUrl;
        }
        else if (resumeUrl !== undefined) {
            // -----------------------------------------------
            // DIRECT URL
            // -----------------------------------------------
            const directUrl = String(resumeUrl).trim();
            if (!directUrl) {
                res.status(400).json({
                    success: false,
                    message: "Resume URL cannot be empty",
                });
                return;
            }
            updateFields["hero.resumeUrl"] = directUrl;
        }
        // ======================================================
        // 8. NOTHING TO UPDATE
        // ======================================================
        if (Object.keys(updateFields).length === 0) {
            res.status(400).json({
                success: false,
                message: "No valid fields to update",
            });
            return;
        }
        // ======================================================
        // 9. UPDATE DATABASE
        // ======================================================
        const doc = await homeHero_1.HomeHero.findByIdAndUpdate(oldDoc._id, {
            $set: updateFields,
        }, {
            new: true,
            runValidators: true,
        });
        if (!doc || !doc.hero) {
            res.status(500).json({
                success: false,
                message: "Hero update failed",
            });
            return;
        }
        // ======================================================
        // 10. DELETE OLD RESUME
        // ======================================================
        const newResumeUrl = updateFields["hero.resumeUrl"];
        if (typeof newResumeUrl === "string" &&
            oldResumeUrl &&
            oldResumeUrl !== newResumeUrl) {
            // শুধু পুরোনো URL Cloudinary হলে
            // Cloudinary থেকে actual PDF delete হবে
            if (oldResumeUrl.includes("res.cloudinary.com")) {
                await (0, uploadMiddleware_1.deleteResumeFromCloudinary)(oldResumeUrl);
            }
            console.log("✅ Old resume replaced");
        }
        // ======================================================
        // 11. CACHE INVALIDATION
        // ======================================================
        invalidate();
        // Drop the frontend's "home" cache tag, then tell every open
        // public tab to refresh. Best-effort: never fails this request.
        await (0, publish_1.publishChange)("home");
        // ======================================================
        // 12. RESPONSE
        // ======================================================
        res.status(200).json({
            success: true,
            message: "Hero updated successfully",
            hero: {
                name: doc.hero.name,
                title: doc.hero.title,
                titles: doc.hero.titles,
                bio: doc.hero.bio,
                image: doc.hero.image,
                resumeUrl: doc.hero.resumeUrl,
                socials: doc.hero.socials.map((social) => ({
                    _id: social._id,
                    label: social.label,
                    href: social.href,
                })),
            },
        });
    }
    catch (error) {
        console.error("❌ Hero Update Error:", error);
        const message = error instanceof Error
            ? error.message
            : "Server error";
        res.status(500).json({
            success: false,
            message,
        });
    }
}
// ── PUT /api/home/stats — replace all stats (frontend contract) ─
async function replaceStats(req, res) {
    try {
        const { stats } = req.body ?? {};
        if (!Array.isArray(stats)) {
            res
                .status(400)
                .json({ success: false, message: "stats must be an array" });
            return;
        }
        if (stats.length > MAX_STATS) {
            res.status(400).json({
                success: false,
                message: `Maximum ${MAX_STATS} stats allowed`,
            });
            return;
        }
        const clean = [];
        for (const s of stats) {
            if (!s || typeof s !== "object") {
                res.status(400).json({ success: false, message: "Invalid stat item" });
                return;
            }
            const value = String(s.value ?? "").trim();
            const label = String(s.label ?? "").trim();
            if (!value || !label) {
                res.status(400).json({
                    success: false,
                    message: "Each stat needs value and label",
                });
                return;
            }
            clean.push({ value: value.slice(0, 50), label: label.slice(0, 100) });
        }
        const doc = await getOrCreateDoc();
        doc.stats = clean;
        await doc.save();
        invalidate();
        // Drop the frontend's "home" cache tag, then tell every open
        // public tab to refresh. Best-effort: never fails this request.
        await (0, publish_1.publishChange)("home");
        res.status(200).json({
            success: true,
            stats: doc.stats.map((s) => ({
                _id: s._id,
                value: s.value,
                label: s.label,
            })),
        });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
// ── POST /api/home/stats — add one stat ─────────────────────────
async function createStat(req, res) {
    try {
        const { value, label } = req.body ?? {};
        if (!value || !label) {
            res
                .status(400)
                .json({ success: false, message: "value and label are required" });
            return;
        }
        const doc = await getOrCreateDoc();
        if (doc.stats.length >= MAX_STATS) {
            res.status(400).json({
                success: false,
                message: `Maximum ${MAX_STATS} stats allowed`,
            });
            return;
        }
        doc.stats.push({
            value: String(value).slice(0, 50),
            label: String(label).slice(0, 100),
        });
        await doc.save();
        invalidate();
        // Drop the frontend's "home" cache tag, then tell every open
        // public tab to refresh. Best-effort: never fails this request.
        await (0, publish_1.publishChange)("home");
        const created = doc.stats[doc.stats.length - 1];
        res.status(201).json({
            success: true,
            stat: { _id: created._id, value: created.value, label: created.label },
        });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
// ── PUT /api/home/stats/:id — update one stat ───────────────────
async function updateStat(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res
                .status(400)
                .json({ success: false, message: "Invalid stat ObjectId" });
            return;
        }
        const { value, label } = req.body ?? {};
        if (value === undefined && label === undefined) {
            res.status(400).json({ success: false, message: "Nothing to update" });
            return;
        }
        const doc = await getOrCreateDoc();
        const stat = doc.stats.find((s) => s._id.toString() === id);
        if (!stat) {
            res.status(404).json({ success: false, message: "Stat not found" });
            return;
        }
        if (value !== undefined)
            stat.value = String(value).slice(0, 50);
        if (label !== undefined)
            stat.label = String(label).slice(0, 100);
        await doc.save();
        invalidate();
        // Drop the frontend's "home" cache tag, then tell every open
        // public tab to refresh. Best-effort: never fails this request.
        await (0, publish_1.publishChange)("home");
        res.status(200).json({
            success: true,
            stat: { _id: stat._id, value: stat.value, label: stat.label },
        });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
// ── DELETE /api/home/stats/:id — delete one stat ────────────────
async function deleteStat(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res
                .status(400)
                .json({ success: false, message: "Invalid stat ObjectId" });
            return;
        }
        const doc = await getOrCreateDoc();
        const exists = doc.stats.some((s) => s._id.toString() === id);
        if (!exists) {
            res.status(404).json({ success: false, message: "Stat not found" });
            return;
        }
        doc.stats = doc.stats.filter((s) => s._id.toString() !== id);
        await doc.save();
        invalidate();
        // Drop the frontend's "home" cache tag, then tell every open
        // public tab to refresh. Best-effort: never fails this request.
        await (0, publish_1.publishChange)("home");
        res
            .status(200)
            .json({ success: true, message: "Stat deleted successfully" });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
// ── POST /api/home/socials — add one social ─────────────────────
async function createSocial(req, res) {
    try {
        const { label, href } = req.body ?? {};
        if (!label || !href) {
            res
                .status(400)
                .json({ success: false, message: "label and href are required" });
            return;
        }
        if (!isValidUrl(String(href))) {
            res.status(400).json({ success: false, message: "Invalid href" });
            return;
        }
        const doc = await getOrCreateDoc();
        if (doc.hero.socials.length >= MAX_SOCIALS) {
            res.status(400).json({
                success: false,
                message: `Maximum ${MAX_SOCIALS} socials allowed`,
            });
            return;
        }
        doc.hero.socials.push({
            label: String(label).slice(0, 50),
            href: String(href).slice(0, 500),
        });
        await doc.save();
        invalidate();
        // Drop the frontend's "home" cache tag, then tell every open
        // public tab to refresh. Best-effort: never fails this request.
        await (0, publish_1.publishChange)("home");
        const created = doc.hero.socials[doc.hero.socials.length - 1];
        res.status(201).json({
            success: true,
            social: { _id: created._id, label: created.label, href: created.href },
        });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
// ── PUT /api/home/socials/:id — update one social ───────────────
async function updateSocial(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res
                .status(400)
                .json({ success: false, message: "Invalid social ObjectId" });
            return;
        }
        const { label, href } = req.body ?? {};
        if (label === undefined && href === undefined) {
            res.status(400).json({ success: false, message: "Nothing to update" });
            return;
        }
        if (href !== undefined && !isValidUrl(String(href))) {
            res.status(400).json({ success: false, message: "Invalid href" });
            return;
        }
        const doc = await getOrCreateDoc();
        const social = doc.hero.socials.find((s) => s._id.toString() === id);
        if (!social) {
            res.status(404).json({ success: false, message: "Social not found" });
            return;
        }
        if (label !== undefined)
            social.label = String(label).slice(0, 50);
        if (href !== undefined)
            social.href = String(href).slice(0, 500);
        await doc.save();
        invalidate();
        // Drop the frontend's "home" cache tag, then tell every open
        // public tab to refresh. Best-effort: never fails this request.
        await (0, publish_1.publishChange)("home");
        res.status(200).json({
            success: true,
            social: { _id: social._id, label: social.label, href: social.href },
        });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
// ── DELETE /api/home/socials/:id — delete one social ────────────
async function deleteSocial(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res
                .status(400)
                .json({ success: false, message: "Invalid social ObjectId" });
            return;
        }
        const doc = await getOrCreateDoc();
        const exists = doc.hero.socials.some((s) => s._id.toString() === id);
        if (!exists) {
            res.status(404).json({ success: false, message: "Social not found" });
            return;
        }
        doc.hero.socials = doc.hero.socials.filter((s) => s._id.toString() !== id);
        await doc.save();
        invalidate();
        // Drop the frontend's "home" cache tag, then tell every open
        // public tab to refresh. Best-effort: never fails this request.
        await (0, publish_1.publishChange)("home");
        res
            .status(200)
            .json({ success: true, message: "Social deleted successfully" });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
