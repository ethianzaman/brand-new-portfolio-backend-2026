/**
 * Emergency password reset, for when a Super Admin is locked out and nobody
 * can use the dashboard to help. It needs access to the server and its .env,
 * so it adds nothing an attacker could reach over the internet.
 *
 * The new password is generated and printed once; it is never taken from the
 * command line, where the shell history would keep it. Every session of that
 * account is signed out.
 *
 * Usage:
 *   npm run reset-password                  # the ADMIN_EMAIL account
 *   npm run reset-password -- user@site.com # any account
 */
import "dotenv/config";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { User } from "../models/User";

async function main(): Promise<void> {
  const email = (process.argv[2] ?? process.env.ADMIN_EMAIL ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    throw new Error("Give an email, or set ADMIN_EMAIL in .env.");
  }

  await connectDB();

  const user = await User.findOne({ email });
  if (!user) {
    throw new Error(`No account found for ${email}.`);
  }

  const password = crypto.randomBytes(18).toString("base64url");
  user.password = password;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  console.log(`\nPassword reset for ${email} (${user.role}).`);
  console.log(`New password: ${password}`);
  console.log("Sign in and change it from the dashboard. It is not shown again.");
  if (!user.isActive) {
    console.log("Note: this account is disabled, so it cannot sign in until enabled.");
  }

  await mongoose.disconnect();
}

main().catch((error: unknown) => {
  // Only the message: a driver error object can carry the connection string.
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Reset failed: ${message.replace(/mongodb(\+srv)?:\/\/\S+/g, "<database>")}`);
  process.exit(1);
});
