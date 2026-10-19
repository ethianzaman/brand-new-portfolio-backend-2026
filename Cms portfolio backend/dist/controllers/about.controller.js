"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateEducation = void 0;
exports.getAbout = getAbout;
exports.updateHero = updateHero;
exports.createExperience = createExperience;
exports.updateExperience = updateExperience;
exports.deleteExperience = deleteExperience;
exports.createEducation = createEducation;
exports.deleteEducation = deleteEducation;
exports.createValue = createValue;
exports.updateValue = updateValue;
exports.deleteValue = deleteValue;
const About_1 = require("../models/About");
const mongoose_1 = __importDefault(require("mongoose"));
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const publish_1 = require("../lib/publish");
// GET /api/about — public
async function getAbout(req, res) {
    try {
        let about = await About_1.About.findOne();
        if (!about) {
            // Auto-create with defaults on first request
            about = await About_1.About.create({
                hero: {
                    name: "Your Name",
                    title: "Full Stack Developer",
                    subtitle: "Building great web products",
                    bio: ["Your bio here."],
                    image: null,
                    resumeUrl: "/resume.pdf",
                    location: "Remote",
                    experience: "1+ Year",
                },
                experiences: [],
                educations: [],
                values: [],
            });
        }
        res.status(200).json({ success: true, about });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
// // PUT /api/about/hero — protected
async function updateHero(req, res) {
    try {
        let heroData = { ...req.body };
        let finalImageUrl;
        // 1️⃣ File upload case (Cloudinary)
        if (req.file) {
            finalImageUrl = await (0, uploadMiddleware_1.uploadToCloudinary)(req.file.buffer, "portfolio_hero");
        }
        // 2️⃣ URL case (direct input)
        else if (heroData.image) {
            finalImageUrl = heroData.image;
        }
        // 3️⃣ set final image (overwrite old always)
        if (finalImageUrl) {
            heroData.image = finalImageUrl;
        }
        // cleanup
        delete heroData.imageUrl;
        // 4️⃣ bio parse
        if (heroData.bio && typeof heroData.bio === "string") {
            try {
                const parsedBio = JSON.parse(heroData.bio);
                heroData.bio = Array.isArray(parsedBio) ? parsedBio : [parsedBio];
            }
            catch {
                heroData.bio = [heroData.bio];
            }
        }
        // 5️⃣ dynamic update
        const updateFields = {};
        for (const key in heroData) {
            updateFields[`hero.${key}`] = heroData[key];
        }
        const about = await About_1.About.findOneAndUpdate({}, { $set: updateFields }, { new: true, upsert: true });
        await (0, publish_1.publishChange)("about");
        res.status(200).json({
            success: true,
            hero: about.hero,
        });
    }
    catch (err) {
        console.error("Hero Update Error:", err);
        res.status(500).json({
            success: false,
            message: err.message || "Internal server error",
        });
    }
}
// POST /api/about/experiences — protected
async function createExperience(req, res) {
    try {
        // ১. ফ্রন্টএন্ড থেকে আসা বডি এবং ইউনিক কাস্টম আইডি মার্জ করা
        const newExperience = {
            ...req.body,
            id: `exp-${Date.now()}`,
        };
        // ২. মঙ্গুজ কোয়েরি ($position: 0 এর কারণে এটি অ্যারের শুরুতে পুশ হবে)
        const updatedAbout = await About_1.About.findOneAndUpdate({}, {
            $push: {
                experiences: {
                    $each: [newExperience],
                    $position: 0,
                },
            },
        }, { new: true, upsert: true });
        // ৩. রেসপন্সে পুরো 'about' ডকুমেন্ট না পাঠিয়ে শুধু নতুন তৈরি হওয়া আইটেমটি
        // অথবা শুধু আপডেটেড experiences অ্যারেটি পাঠানোই বেস্ট প্র্যাকটিস (ফ্রন্টএন্ড স্টেটের জন্য সুবিধা)
        // ✅ এটা করো
        const savedExp = updatedAbout.experiences[0];
        await (0, publish_1.publishChange)("about"); // Publish change after successful creation
        res.status(201).json({
            success: true,
            message: "Experience created successfully",
            experience: savedExp,
            allExperiences: updatedAbout.experiences, // অপশনাল: ফ্রন্টএন্ডে সরাসরি স্টেট সিঙ্ক করার জন্য
        });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
}
// PUT /api/about/experiences/:id — protected
async function updateExperience(req, res) {
    try {
        const { id } = req.params;
        const updateData = req.body;
        // 1️⃣ Validate ObjectId
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid experience ObjectId",
            });
            return;
        }
        // 2️⃣ Validate body
        if (!updateData || Object.keys(updateData).length === 0) {
            res.status(400).json({
                success: false,
                message: "No update data provided",
            });
            return;
        }
        // 3️⃣ Allowed fields (SECURITY LAYER)
        const allowedFields = [
            "role",
            "company",
            "type",
            "period",
            "current",
            "description",
            "tags",
        ];
        const updateFields = {};
        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                updateFields[`experiences.$.${field}`] = updateData[field];
            }
        }
        console.log("UPDATE FIELDS:", updateFields);
        // 4️⃣ Prevent silent fail
        if (Object.keys(updateFields).length === 0) {
            res.status(400).json({
                success: false,
                message: "No valid fields to update",
            });
            return;
        }
        // 5️⃣ Update using Mongo _id inside array
        const updatedAbout = await About_1.About.findOneAndUpdate({
            "experiences._id": new mongoose_1.default.Types.ObjectId(id),
        }, {
            $set: updateFields,
        }, {
            new: true,
            runValidators: true,
        });
        // 6️⃣ Not found check
        if (!updatedAbout) {
            res.status(404).json({
                success: false,
                message: "Experience not found",
            });
            return;
        }
        // 7️⃣ Extract updated experience
        const updatedExp = updatedAbout.experiences.find((exp) => exp._id.toString() === id);
        console.log("UPDATED EXP:", updatedExp);
        await (0, publish_1.publishChange)("about"); // Publish change after successful update
        // 8️⃣ Response
        res.status(200).json({
            success: true,
            message: "Experience updated successfully",
            experience: updatedExp,
        });
    }
    catch (error) {
        console.error("UPDATE EXPERIENCE ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
}
// DELETE /api/about/experiences/:id — protected
async function deleteExperience(req, res) {
    try {
        const { id } = req.params;
        console.log("DELETE EXPERIENCE ID:", id);
        // 1️⃣ Validate ObjectId
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid experience ObjectId",
            });
            return;
        }
        // 2️⃣ Delete from array using Mongo _id
        const updatedAbout = await About_1.About.findOneAndUpdate({
            "experiences._id": new mongoose_1.default.Types.ObjectId(id),
        }, {
            $pull: {
                experiences: {
                    _id: new mongoose_1.default.Types.ObjectId(id),
                },
            },
        }, {
            new: true,
        });
        // 3️⃣ Not found check
        if (!updatedAbout) {
            res.status(404).json({
                success: false,
                message: "Experience not found",
            });
            return;
        }
        await (0, publish_1.publishChange)("about"); // Publish change after successful deletion
        // 4️⃣ Success response
        res.status(200).json({
            success: true,
            message: "Experience deleted successfully",
        });
    }
    catch (error) {
        console.error("DELETE EXPERIENCE ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
}
// POST /api/about/educations — protected
async function createEducation(req, res) {
    try {
        const edu = { ...req.body, id: `edu-${Date.now()}` };
        const about = await About_1.About.findOneAndUpdate({}, { $push: { educations: { $each: [edu], $position: 0 } } }, { new: true, upsert: true });
        // ✅ MongoDB-generated _id সহ actual saved object return করো
        const savedEdu = about.educations[0]; // position: 0 তে push করেছো, তাই
        await (0, publish_1.publishChange)("about"); // Publish change after successful creation
        res.status(201).json({ success: true, education: savedEdu });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
}
// UPDATE /api/about/educations/:id — protected
const updateEducation = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        // 1️⃣ Validate ObjectId
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid education ObjectId",
            });
            return;
        }
        // 2️⃣ Check empty body
        if (!updateData || Object.keys(updateData).length === 0) {
            res.status(400).json({
                success: false,
                message: "No update data provided",
            });
            return;
        }
        // 3️⃣ Allowed fields (SECURITY LAYER)
        const allowedFields = [
            "degree",
            "school",
            "period",
            "description",
            "grade",
        ];
        const updateFields = {};
        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                updateFields[`educations.$[edu].${field}`] = updateData[field];
            }
        }
        console.log("UPDATE FIELDS:", updateFields);
        // 4️⃣ Prevent silent fail (IMPORTANT)
        if (Object.keys(updateFields).length === 0) {
            res.status(400).json({
                success: false,
                message: "No valid fields to update",
            });
            return;
        }
        const updatedAbout = await About_1.About.findOneAndUpdate({}, {
            $set: updateFields,
        }, {
            new: true,
            runValidators: true,
            arrayFilters: [
                {
                    "edu._id": new mongoose_1.default.Types.ObjectId(id),
                },
            ],
        });
        // 6️⃣ Not found check
        if (!updatedAbout) {
            res.status(404).json({
                success: false,
                message: "Education not found",
            });
            return;
        }
        // 7️⃣ Extract updated education
        const updatedEdu = updatedAbout.educations.find((edu) => edu._id.toString() === id);
        console.log("UPDATED EDU:", updatedEdu);
        await (0, publish_1.publishChange)("about"); // Publish change after successful update
        // 8️⃣ Success response
        res.status(200).json({
            success: true,
            message: "Education updated successfully",
            education: JSON.parse(JSON.stringify(updatedEdu)),
        });
    }
    catch (error) {
        console.error("UPDATE EDUCATION ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
};
exports.updateEducation = updateEducation;
// DELETE /api/about/educations/:id — protected
async function deleteEducation(req, res) {
    try {
        const { id } = req.params;
        console.log("DELETE EDUCATION ID:", id);
        // 1️⃣ Validate ObjectId
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid education ObjectId",
            });
            return;
        }
        // 2️⃣ Delete from nested array safely
        const updatedAbout = await About_1.About.findOneAndUpdate({
            "educations._id": new mongoose_1.default.Types.ObjectId(id),
        }, {
            $pull: {
                educations: {
                    _id: new mongoose_1.default.Types.ObjectId(id),
                },
            },
        }, {
            new: true,
        });
        // 3️⃣ Not found check
        if (!updatedAbout) {
            res.status(404).json({
                success: false,
                message: "Education not found",
            });
            return;
        }
        // console.log("UPDATED EDUCATIONS:", updatedAbout.educations);
        await (0, publish_1.publishChange)("about"); // Publish change after successful deletion
        // 4️⃣ Success response
        res.status(200).json({
            success: true,
            message: "Education deleted successfully",
        });
    }
    catch (error) {
        console.error("DELETE EDUCATION ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
}
// POST /api/about/values — protected
async function createValue(req, res) {
    try {
        const val = { ...req.body, _id: new mongoose_1.default.Types.ObjectId() };
        const about = await About_1.About.findOneAndUpdate({}, { $push: { values: val } }, { new: true, upsert: true });
        await (0, publish_1.publishChange)("about"); // Publish change after successful creation
        res.status(201).json({
            success: true,
            message: "Value created successfully",
            value: val,
        });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
}
//PUT /api/about/values/:id — protected
async function updateValue(req, res) {
    try {
        const { id } = req.params;
        // ✅ 1. Validate ObjectId
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res
                .status(400)
                .json({ success: false, message: "Invalid value ObjectId" });
            return;
        }
        // ✅ 2. Allowed fields (security layer)
        const allowedFields = ["icon", "title", "desc"];
        const updateFields = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateFields[`values.$.${field}`] = req.body[field];
            }
        }
        if (Object.keys(updateFields).length === 0) {
            res
                .status(400)
                .json({ success: false, message: "No valid fields to update" });
            return;
        }
        // ✅ 3. ObjectId convert করে query
        const about = await About_1.About.findOneAndUpdate({ "values._id": new mongoose_1.default.Types.ObjectId(id) }, { $set: updateFields }, { new: true, runValidators: true });
        // ✅ 4. null check আগে
        if (!about) {
            res.status(404).json({ success: false, message: "Value not found" });
            return;
        }
        // ✅ 5. Type safe find — IValue import না লাগলেও হবে
        const updated = about.values.find((v) => v._id.equals(new mongoose_1.default.Types.ObjectId(id)));
        await (0, publish_1.publishChange)("about"); // Publish change after successful update
        res.status(200).json({ success: true, value: updated });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Server error";
        res.status(500).json({ success: false, message });
    }
}
async function deleteValue(req, res) {
    try {
        const { id } = req.params;
        // ✅ 1. Validate ObjectId
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res
                .status(400)
                .json({ success: false, message: "Invalid value ObjectId" });
            return;
        }
        // ✅ 2. _id দিয়ে match, id দিয়ে নয়
        const updatedAbout = await About_1.About.findOneAndUpdate({ "values._id": new mongoose_1.default.Types.ObjectId(id) }, { $pull: { values: { _id: new mongoose_1.default.Types.ObjectId(id) } } }, { new: true });
        // ✅ 3. Not found check
        if (!updatedAbout) {
            res.status(404).json({ success: false, message: "Value not found" });
            return;
        }
        await (0, publish_1.publishChange)("about"); // Publish change after successful deletion
        res
            .status(200)
            .json({ success: true, message: "Value deleted successfully" });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Server error";
        res.status(500).json({ success: false, message });
    }
}
