/**
 * One-time role migration for accounts created before role-based access
 * control was introduced (those documents have role: "" and cannot sign in).
 *
 * What it does:
 *   1. Promotes the ADMIN_EMAIL account (if it exists) to an active admin.
 *   2. Assigns a safe default role to every user whose role is missing or
 *      invalid. Default is `editor` (least privilege that still allows
 *      content work) — override with MIGRATION_DEFAULT_ROLE=manager.
 *
 * Nothing else is changed. No account gains admin unless it is the
 * designated ADMIN_EMAIL bootstrap account.
 *
 * Usage:
 *   npm run migrate:roles                # apply
 *   npm run migrate:roles -- --dry-run   # preview only
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../../config/db";
import { User, USER_ROLES, UserRole } from "../../models/User";

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const defaultRole = (process.env.MIGRATION_DEFAULT_ROLE ??
    "editor") as UserRole;

  if (!USER_ROLES.includes(defaultRole)) {
    console.error(
      `❌ MIGRATION_DEFAULT_ROLE must be one of: ${USER_ROLES.join(", ")}`
    );
    process.exit(1);
  }

  await connectDB();

  // ── 1. Bootstrap admin ────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail) {
    const admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      console.log(
        `⚠️  ${adminEmail} not found — it will be created on next server start by the admin seed.`
      );
    } else if (admin.role !== "super_admin" || admin.isActive !== true) {
      console.log(
        `${dryRun ? "[dry-run] " : ""}Promoting ${adminEmail} → admin (active)`
      );
      if (!dryRun) {
        admin.role = "super_admin";
        admin.isActive = true;
        await admin.save();
      }
    } else {
      console.log(`✅ ${adminEmail} is already an active admin`);
    }
  } else {
    console.warn("⚠️  ADMIN_EMAIL not set — skipping admin promotion");
  }

  // ── 2. Repair users with missing/invalid roles ────────────────────
  const invalid = await User.find({
    $or: [{ role: { $nin: [...USER_ROLES] } }, { role: null }],
  });

  if (invalid.length === 0) {
    console.log("✅ All users have a valid role");
  } else {
    for (const user of invalid) {
      console.log(
        `${dryRun ? "[dry-run] " : ""}${user.email}: '${user.role}' → ${defaultRole}`
      );
      if (!dryRun) {
        user.role = defaultRole;
        if (typeof user.isActive !== "boolean") user.isActive = true;
        await user.save();
      }
    }
    console.log(
      `${dryRun ? "Would update" : "Updated"} ${invalid.length} user(s).`
    );
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
