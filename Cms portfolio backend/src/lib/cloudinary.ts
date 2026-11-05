import { v2 as cloudinary, type UploadApiOptions } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

function uploadBuffer(fileBuffer: Buffer, options: UploadApiOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        return reject(
          Object.assign(new Error(error.message), { statusCode: error.http_code }),
        );
      }
      if (result?.secure_url) return resolve(result.secure_url);
      reject(new Error("Upload failed"));
    });
    stream.end(fileBuffer);
  });
}

/**
 * Uploads as `image`, not `auto`: Cloudinary then rejects anything that is not
 * really an image, whatever mime type the request claimed.
 */
export function uploadImage(fileBuffer: Buffer, folder: string): Promise<string> {
  return uploadBuffer(fileBuffer, { folder, resource_type: "image" });
}

export function uploadResume(fileBuffer: Buffer, folder: string): Promise<string> {
  return uploadBuffer(fileBuffer, {
    folder,
    resource_type: "image",
    format: "pdf",
    use_filename: true,
    unique_filename: true,
  });
}

/** The size and format link previews expect, cropped around the subject. */
export function toShareImageUrl(url: string): string {
  return url.replace(
    /(res\.cloudinary\.com\/[^/]+\/image\/upload\/)/,
    "$1c_fill,g_auto,w_1200,h_630,f_jpg,q_auto/",
  );
}
