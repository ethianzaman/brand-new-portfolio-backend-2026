import mongoose from "mongoose";
import { afterAll, beforeAll, inject, vi } from "vitest";

// Nothing here reads .env, so a test can't reach the real database, Cloudinary,
// mail provider or frontend. These are read when the app modules load.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-secret";
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
delete process.env.FRONTEND_URL;
delete process.env.REVALIDATE_SECRET;
delete process.env.RESEND_API_KEY;
delete process.env.GMAIL_USER;
delete process.env.GMAIL_APP_PASSWORD;

/** Public ids Cloudinary was asked to delete, for tests to check. */
export const destroyedFiles: string[] = [];

vi.mock("cloudinary", () => {
  let uploads = 0;
  return {
    v2: {
      config: () => undefined,
      uploader: {
        upload_stream: (
          options: { folder: string },
          done: (error: unknown, result?: { secure_url: string }) => void,
        ) => ({
          end: () => {
            uploads += 1;
            done(null, {
              secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v1/${options.folder}/file-${uploads}.png`,
            });
          },
        }),
        destroy: async (publicId: string) => {
          destroyedFiles.push(publicId);
          return { result: "ok" };
        },
      },
    },
  };
});

beforeAll(async () => {
  const uri = inject("mongoUri");
  if (!uri.includes("127.0.0.1")) {
    throw new Error("Tests only run against the local in-memory database.");
  }
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
});
