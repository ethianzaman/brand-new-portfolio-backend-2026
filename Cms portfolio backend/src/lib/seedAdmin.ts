import { User } from "../models/User";

/**
 * Creates the ADMIN_EMAIL account as a Super Admin, or promotes that specific
 * account if it already exists. No other account is ever touched: other users
 * keep their role and must be migrated explicitly (npm run migrate:roles).
 */
export async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    console.warn("⚠️  ADMIN_EMAIL is not set — skipping admin seed");
    return;
  }
  const password = process.env.ADMIN_PASSWORD;
  const existing = await User.findOne({ email });
  if (!existing) {
    if (!password) {
      console.warn(
        "⚠️  ADMIN_EMAIL is set but ADMIN_PASSWORD is not — skipping admin seed"
      );
      return;
    }
    await User.create({ email, password, role: "super_admin", isActive: true });
    console.log("✅ Super Admin seeded");
    return;
  }
  if (existing.role !== "super_admin" || existing.isActive !== true) {
    existing.role = "super_admin";
    existing.isActive = true;
    await existing.save();
    console.log(`✅ Bootstrap account ${email} promoted to active Super Admin`);
  }
}
