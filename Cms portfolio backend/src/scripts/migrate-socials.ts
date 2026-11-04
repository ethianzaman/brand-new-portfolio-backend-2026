/**
 * Moves the social links onto the shared library.
 *
 * Merges the Site Settings, Home Hero and Contact lists without duplicates and
 * selects, for each section, the links it already showed. So the public site
 * looks the same right after the migration.
 *
 * Safe to re-run: an already migrated document is left alone. Only the settings
 * document changes; the old Home Hero and Contact fields are kept.
 *
 * Usage:
 *   npm run migrate:socials -- --dry-run   # preview only
 *   npm run migrate:socials                # apply
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { publishChange } from "../lib/publish";
import { ensureSocialLibrary, loadSocialLibraryPlan } from "../lib/socialLibrary";
import { SiteSettings, SOCIAL_PLACEMENT_KEYS } from "../models/SiteSettings";

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  await connectDB();

  const doc = await SiteSettings.findOne();
  if (!doc) {
    console.log("No settings document yet. A new one starts on the library.");
    return;
  }

  if (doc.socialsConfigured) {
    console.log("Already migrated. Nothing to do.");
    return;
  }

  const plan = await loadSocialLibraryPlan(
    doc.socials.map((social: { toObject?: () => object }) =>
      social.toObject ? social.toObject() : social,
    ),
  );

  console.log(`Library (${plan.socials.length} links):`);
  for (const social of plan.socials) {
    console.log(`  ${social.label.padEnd(16)} ${social.icon.padEnd(10)} ${social.href}`);
  }

  console.log(`\nAdded from Home Hero / Contact: ${plan.added.join(", ") || "none"}`);

  console.log("\nSections:");
  for (const key of SOCIAL_PLACEMENT_KEYS) {
    const labels = plan.placements[key].map(
      (id) => plan.socials.find((social) => social.id === id)?.label,
    );
    console.log(`  ${key.padEnd(12)} ${labels.join(", ") || "(none)"}`);
  }

  if (dryRun) {
    console.log("\nDry run: nothing was changed.");
    return;
  }

  await ensureSocialLibrary(doc);
  await doc.save();
  await publishChange("settings");
  console.log("\nMigrated.");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
