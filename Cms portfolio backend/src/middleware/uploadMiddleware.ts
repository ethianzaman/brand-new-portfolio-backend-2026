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