"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadResumeToCloudinary = exports.uploadToCloudinary = exports.upload = void 0;
exports.isCloudinaryUrl = isCloudinaryUrl;
exports.getPublicId = getPublicId;
exports.deleteFromCloudinary = deleteFromCloudinary;
exports.deleteResumeFromCloudinary = deleteResumeFromCloudinary;
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = require("cloudinary");
// ১. ক্লাউডিনারি কনফিগারেশন (আপনার .env ফাইল থেকে ডেটা নেবে)
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
// ২. মাল্টার মেমোরি স্টোরেজ সেটআপ (ফাইল সরাসরি বাফারে জমা থাকবে)
const storage = multer_1.default.memoryStorage();
exports.upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 3 * 1024 * 1024 }, // সর্বোচ্চ ৩ মেগাবাইট ফাইল সাইজ লিমিট
});
// ৩. ক্লাউডিনারিতে বাফার থেকে ইমেজ আপলোড করার হেল্পার ফাংশন
const uploadToCloudinary = (fileBuffer, folder) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({ folder: folder, resource_type: "auto" }, (error, result) => {
            if (error)
                return reject(error);
            if (result)
                return resolve(result.secure_url);
            reject(new Error("Upload failed"));
        });
        uploadStream.end(fileBuffer);
    });
};
exports.uploadToCloudinary = uploadToCloudinary;
// export const uploadResumeToCloudinary = (
//   fileBuffer: Buffer,
//   folder: string,
// ): Promise<string> => {
//   return new Promise((resolve, reject) => {
//     const publicId = `resume_${Date.now()}.pdf`;
//     const uploadStream = cloudinary.uploader.upload_stream(
//       {
//         folder,
//         resource_type: "raw",
//         public_id: publicId,
//         overwrite: false,
//       },
//       (error, result) => {
//         if (error) {
//           console.error("❌ Resume Cloudinary upload failed:", error);
//           return reject(error);
//         }
//         if (!result?.secure_url) {
//           return reject(
//             new Error("Resume upload failed: No secure URL returned"),
//           );
//         }
//         console.log("✅ Resume uploaded successfully");
//         console.log("📄 URL:", result.secure_url);
//         console.log("🆔 Public ID:", result.public_id);
//         console.log("📦 Resource Type:", result.resource_type);
//         resolve(result.secure_url);
//       },
//     );
//     uploadStream.end(fileBuffer);
//   });
// };
const uploadResumeToCloudinary = (fileBuffer, folder) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({
            folder,
            resource_type: "image",
            format: "pdf",
            use_filename: true,
            unique_filename: true,
        }, (error, result) => {
            if (error) {
                console.error("❌ Resume upload failed:", error);
                return reject(error);
            }
            if (result?.secure_url) {
                console.log("✅ Resume uploaded:", result.secure_url);
                console.log("Public ID:", result.public_id);
                console.log("Resource Type:", result.resource_type);
                console.log("Format:", result.format);
                return resolve(result.secure_url);
            }
            reject(new Error("Resume upload failed"));
        });
        uploadStream.end(fileBuffer);
    });
};
exports.uploadResumeToCloudinary = uploadResumeToCloudinary;
/**
 * Check Cloudinary URL
 */
function isCloudinaryUrl(url) {
    return url.includes("res.cloudinary.com");
}
/**
 * Extract public_id from Cloudinary URL
 */
function getPublicId(url) {
    try {
        const uploadIndex = url.indexOf("/upload/");
        if (uploadIndex === -1)
            return null;
        let path = url.substring(uploadIndex + 8);
        // remove version (v123456/)
        path = path.replace(/^v\d+\//, "");
        // remove extension
        path = path.replace(/\.[^/.]+$/, "");
        return path;
    }
    catch {
        return null;
    }
}
async function deleteFromCloudinary(url) {
    try {
        if (!isCloudinaryUrl(url))
            return;
        const publicId = getPublicId(url);
        if (!publicId)
            return;
        await cloudinary_1.v2.uploader.destroy(publicId);
    }
    catch (err) {
        console.error("Cloudinary delete failed:", err);
    }
}
// export async function deleteResumeFromCloudinary(
//   url: string,
// ): Promise<void> {
//   try {
//     if (!isCloudinaryUrl(url)) return;
//     const uploadIndex = url.indexOf("/upload/");
//     if (uploadIndex === -1) return;
//     let publicId = url.substring(
//       uploadIndex + "/upload/".length,
//     );
//     // Remove version
//     publicId = publicId.replace(/^v\d+\//, "");
//     console.log("🗑️ Deleting old resume:", publicId);
//     await cloudinary.uploader.destroy(publicId, {
//       resource_type: "raw",
//       type: "upload",
//     });
//     console.log("✅ Old resume deleted:", publicId);
//   } catch (error) {
//     console.error(
//       "⚠️ Resume delete failed:",
//       error,
//     );
//   }
// }
async function deleteResumeFromCloudinary(url) {
    try {
        if (!isCloudinaryUrl(url))
            return;
        const uploadIndex = url.indexOf("/upload/");
        if (uploadIndex === -1)
            return;
        let publicId = url.substring(uploadIndex + "/upload/".length);
        publicId = publicId.replace(/^v\d+\//, "");
        publicId = publicId.replace(/\.[^/.]+$/, "");
        const resourceType = url.includes("/raw/upload/")
            ? "raw"
            : "image";
        await cloudinary_1.v2.uploader.destroy(publicId, {
            resource_type: resourceType,
        });
        console.log(`🗑️ Old resume deleted (${resourceType}):`, publicId);
    }
    catch (error) {
        console.error("⚠️ Resume delete failed:", error);
    }
}
