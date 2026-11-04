import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

// ১. ক্লাউডিনারি কনফিগারেশন (আপনার .env ফাইল থেকে ডেটা নেবে)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ২. মাল্টার মেমোরি স্টোরেজ সেটআপ (ফাইল সরাসরি বাফারে জমা থাকবে)
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // সর্বোচ্চ ৩ মেগাবাইট ফাইল সাইজ লিমিট
});

const SOCIAL_LOGO_MAX_BYTES = 1024 * 1024;

const socialLogo = multer({
  storage,
  limits: { fileSize: SOCIAL_LOGO_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) return cb(null, true);
    cb(new Error("Logo must be an image file"));
  },
}).single("logo");

/** Optional `logo` image, up to 1 MB. Bad files answer 400, not a server error. */
export function socialLogoUpload(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  socialLogo(req, res, (err: unknown) => {
    if (!err) return next();

    const tooLarge =
      err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE";

    res.status(400).json({
      success: false,
      message: tooLarge
        ? "Logo must be 1 MB or smaller"
        : err instanceof Error
          ? err.message
          : "Could not read the uploaded file",
    });
  });
}

/**
 * Uploads as `image`, not `auto`: Cloudinary then rejects anything that is not
 * really an image, whatever mime type the request claimed.
 */
export const uploadImageToCloudinary = (
  fileBuffer: Buffer,
  folder: string,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) {
          return reject(
            Object.assign(new Error(error.message), {
              statusCode: error.http_code,
            }),
          );
        }
        if (result) return resolve(result.secure_url);
        reject(new Error("Upload failed"));
      },
    );
    uploadStream.end(fileBuffer);
  });
};

// ৩. ক্লাউডিনারিতে বাফার থেকে ইমেজ আপলোড করার হেল্পার ফাংশন
export const uploadToCloudinary = (
  fileBuffer: Buffer,
  folder: string,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: folder, resource_type: "auto" },
      (error, result) => {
        if (error) return reject(error);
        if (result) return resolve(result.secure_url);
        reject(new Error("Upload failed"));
      },
    );
    uploadStream.end(fileBuffer);
  });
};

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


export const uploadResumeToCloudinary = (
  fileBuffer: Buffer,
  folder: string,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        format: "pdf",
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
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
      },
    );

    uploadStream.end(fileBuffer);
  });
};

/**
 * Check Cloudinary URL
 */
export function isCloudinaryUrl(url: string): boolean {
  return url.includes("res.cloudinary.com");
}

/**
 * Extract public_id from Cloudinary URL
 */
export function getPublicId(url: string): string | null {
  try {
    const uploadIndex = url.indexOf("/upload/");

    if (uploadIndex === -1) return null;

    let path = url.substring(uploadIndex + 8);

    // remove version (v123456/)
    path = path.replace(/^v\d+\//, "");

    // remove extension
    path = path.replace(/\.[^/.]+$/, "");

    return path;
  } catch {
    return null;
  }
}

export async function deleteFromCloudinary(url: string): Promise<void> {
  try {
    if (!isCloudinaryUrl(url)) return;

    const publicId = getPublicId(url);

    if (!publicId) return;

    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
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

export async function deleteResumeFromCloudinary(
  url: string,
): Promise<void> {
  try {
    if (!isCloudinaryUrl(url)) return;

    const uploadIndex = url.indexOf("/upload/");
    if (uploadIndex === -1) return;

    let publicId = url.substring(
      uploadIndex + "/upload/".length,
    );

    publicId = publicId.replace(/^v\d+\//, "");
    publicId = publicId.replace(/\.[^/.]+$/, "");

    const resourceType = url.includes("/raw/upload/")
      ? "raw"
      : "image";

    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    console.log(
      `🗑️ Old resume deleted (${resourceType}):`,
      publicId,
    );
  } catch (error) {
    console.error("⚠️ Resume delete failed:", error);
  }
}