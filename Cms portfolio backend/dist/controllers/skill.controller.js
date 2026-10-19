"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSkills = getSkills;
exports.createCategory = createCategory;
exports.updateCategory = updateCategory;
exports.deleteCategory = deleteCategory;
exports.addSkill = addSkill;
exports.updateSkill = updateSkill;
exports.deleteSkill = deleteSkill;
const SKill_1 = require("../models/SKill");
const mongoose_1 = __importDefault(require("mongoose"));
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const publish_1 = require("../lib/publish");
// GET /api/skills — public
async function getSkills(req, res) {
    try {
        const categories = await SKill_1.SkillCategory.find().sort({ order: 1 });
        res.status(200).json({ success: true, categories });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
}
// POST /api/skills/categories — protected
async function createCategory(req, res) {
    try {
        const { label } = req.body;
        if (!label?.trim()) {
            res.status(400).json({
                success: false,
                message: "Category label is required.",
            });
            return;
        }
        const exists = await SKill_1.SkillCategory.findOne({
            label: {
                $regex: new RegExp(`^${label.trim()}$`, "i"),
            },
        });
        if (exists) {
            res.status(409).json({
                success: false,
                message: "Category already exists.",
            });
            return;
        }
        // Get last order
        const lastCategory = await SKill_1.SkillCategory.findOne()
            .sort({ order: -1 })
            .select("order");
        const order = lastCategory ? lastCategory.order + 1 : 0;
        const category = await SKill_1.SkillCategory.create({
            label: label.trim(),
            order,
            skills: [],
        });
        await (0, publish_1.publishChange)("skills");
        res.status(201).json({
            success: true,
            message: "Category created successfully.",
            category,
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}
// PUT /api/skills/categories/:id — protected
async function updateCategory(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid category id.",
            });
            return;
        }
        const category = await SKill_1.SkillCategory.findByIdAndUpdate(id, {
            label: req.body.label,
        }, {
            new: true,
            runValidators: true,
        });
        if (!category) {
            res.status(404).json({
                success: false,
                message: "Category not found.",
            });
            return;
        }
        await (0, publish_1.publishChange)("skills");
        res.status(200).json({
            success: true,
            message: "Category updated successfully.",
            category,
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}
// DELETE /api/skills/categories/:id — protected
async function deleteCategory(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid category id.",
            });
            return;
        }
        const category = await SKill_1.SkillCategory.findByIdAndDelete(id);
        if (!category) {
            res.status(404).json({
                success: false,
                message: "Category not found.",
            });
            return;
        }
        await (0, publish_1.publishChange)("skills");
        res.status(200).json({
            success: true,
            message: "Category deleted successfully.",
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}
// POST /api/skills/categories/:id/skills — protected
async function addSkill(req, res) {
    try {
        const { id } = req.params;
        const { name, icon } = req.body;
        // Validate category id
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid category id.",
            });
            return;
        }
        // Validate name
        if (!name?.trim()) {
            res.status(400).json({
                success: false,
                message: "Skill name is required.",
            });
            return;
        }
        // Find category
        const category = await SKill_1.SkillCategory.findById(id);
        if (!category) {
            res.status(404).json({
                success: false,
                message: "Category not found.",
            });
            return;
        }
        // Duplicate skill check
        const exists = category.skills.some((skill) => skill.name.trim().toLowerCase() === name.trim().toLowerCase());
        if (exists) {
            res.status(409).json({
                success: false,
                message: "Skill already exists.",
            });
            return;
        }
        // Final icon url
        let finalIcon = "";
        // Upload to Cloudinary
        if (req.file) {
            finalIcon = await (0, uploadMiddleware_1.uploadToCloudinary)(req.file.buffer, "portfolio_skills");
        }
        // CDN URL
        else if (icon?.trim()) {
            finalIcon = icon.trim();
        }
        // Nothing provided
        else {
            res.status(400).json({
                success: false,
                message: "Please upload an image or provide an icon URL.",
            });
            return;
        }
        // Push skill
        category.skills.push({
            name: name.trim(),
            icon: finalIcon,
        });
        await category.save();
        await (0, publish_1.publishChange)("skills");
        res.status(201).json({
            success: true,
            message: "Skill created successfully.",
            category,
        });
    }
    catch (err) {
        console.error("Create Skill Error:", err);
        res.status(500).json({
            success: false,
            message: err.message || "Internal server error.",
        });
    }
}
// PUT /api/skills/categories/:id/skills/:skillName — protected
async function updateSkill(req, res) {
    try {
        const { id, skillName } = req.params;
        const { targetCategoryId } = req.body;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid category id.",
            });
            return;
        }
        const sourceCategory = await SKill_1.SkillCategory.findById(id);
        if (!sourceCategory) {
            res.status(404).json({
                success: false,
                message: "Category not found.",
            });
            return;
        }
        const destinationCategory = targetCategoryId && targetCategoryId !== id
            ? await SKill_1.SkillCategory.findById(targetCategoryId)
            : sourceCategory;
        if (!destinationCategory) {
            res.status(404).json({
                success: false,
                message: "Destination category not found.",
            });
            return;
        }
        const oldName = decodeURIComponent(skillName);
        const skill = sourceCategory.skills.find((s) => s.name === oldName);
        if (!skill) {
            res.status(404).json({
                success: false,
                message: "Skill not found.",
            });
            return;
        }
        //---------------------------------------
        // Prepare updated values
        //---------------------------------------
        let newName = skill.name;
        let newIcon = skill.icon;
        if (req.body.name?.trim()) {
            newName = req.body.name.trim();
        }
        if (req.file) {
            if ((0, uploadMiddleware_1.isCloudinaryUrl)(skill.icon)) {
                await (0, uploadMiddleware_1.deleteFromCloudinary)(skill.icon);
            }
            newIcon = await (0, uploadMiddleware_1.uploadToCloudinary)(req.file.buffer, "portfolio_skills");
        }
        else if (req.body.icon &&
            typeof req.body.icon === "string" &&
            req.body.icon.trim() !== "") {
            const url = req.body.icon.trim();
            if ((0, uploadMiddleware_1.isCloudinaryUrl)(skill.icon) && skill.icon !== url) {
                await (0, uploadMiddleware_1.deleteFromCloudinary)(skill.icon);
            }
            newIcon = url;
        }
        //---------------------------------------
        // Duplicate check
        //---------------------------------------
        const duplicate = destinationCategory.skills.some((s) => s.name.trim().toLowerCase() === newName.trim().toLowerCase() &&
            s.name !== oldName);
        if (duplicate) {
            res.status(409).json({
                success: false,
                message: "Skill already exists.",
            });
            return;
        }
        //---------------------------------------
        // Move another category
        //---------------------------------------
        if (destinationCategory.id !== sourceCategory.id) {
            sourceCategory.skills = sourceCategory.skills.filter((s) => s.name !== oldName);
            destinationCategory.skills.push({
                name: newName,
                icon: newIcon,
            });
            await sourceCategory.save();
            await destinationCategory.save();
            await (0, publish_1.publishChange)("skills");
            res.status(200).json({
                success: true,
                message: "Skill moved successfully.",
                sourceCategory,
                destinationCategory,
            });
            return;
        }
        //---------------------------------------
        // Same category update
        //---------------------------------------
        skill.name = newName;
        skill.icon = newIcon;
        await sourceCategory.save();
        await (0, publish_1.publishChange)("skills");
        res.status(200).json({
            success: true,
            message: "Skill updated successfully.",
            category: sourceCategory,
        });
    }
    catch (err) {
        console.error("Update Skill Error:", err);
        res.status(500).json({
            success: false,
            message: err.message || "Internal server error.",
        });
    }
}
// DELETE /api/skills/categories/:id/skills/:skillName — protected
async function deleteSkill(req, res) {
    try {
        const { id, skillName } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid category id.",
            });
            return;
        }
        const category = await SKill_1.SkillCategory.findById(id);
        if (!category) {
            res.status(404).json({
                success: false,
                message: "Category not found.",
            });
            return;
        }
        const decodedName = decodeURIComponent(skillName);
        const skill = category.skills.find((s) => s.name === decodedName);
        if (!skill) {
            res.status(404).json({
                success: false,
                message: "Skill not found.",
            });
            return;
        }
        /**
         * Delete Cloudinary image first
         */
        if (skill.icon && (0, uploadMiddleware_1.isCloudinaryUrl)(skill.icon)) {
            await (0, uploadMiddleware_1.deleteFromCloudinary)(skill.icon);
        }
        /**
         * Remove from array
         */
        category.skills = category.skills.filter((s) => s.name !== decodedName);
        await category.save();
        await (0, publish_1.publishChange)("skills");
        res.status(200).json({
            success: true,
            message: "Skill deleted successfully.",
            category,
        });
    }
    catch (err) {
        console.error("Delete Skill Error:", err);
        res.status(500).json({
            success: false,
            message: err.message || "Internal server error.",
        });
    }
}
