import type { NextFunction, Request, Response } from "express";
import multer from "multer";

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed =
      file.mimetype.startsWith("image/") ||
      (file.fieldname === "resume" && file.mimetype === "application/pdf");
    if (allowed) return cb(null, true);
    cb(Object.assign(new Error("This file type is not allowed"), { statusCode: 400 }));
  },
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
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

const OG_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
// What social networks reliably show. SVG and GIF previews are not.
const OG_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const ogImage = multer({
  storage,
  limits: { fileSize: OG_IMAGE_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (OG_IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Use a JPG, PNG or WebP image"));
  },
}).single("image");

/** One share image, up to 3 MB. Bad files answer 400, not a server error. */
export function ogImageUpload(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  ogImage(req, res, (err: unknown) => {
    if (!err) return next();

    const tooLarge =
      err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE";

    res.status(400).json({
      success: false,
      message: tooLarge
        ? "The image must be 3 MB or smaller"
        : err instanceof Error
          ? err.message
          : "Could not read the uploaded file",
    });
  });
}
