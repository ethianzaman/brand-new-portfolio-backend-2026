/**
 * One-off backfill: gives older projects and services a URL slug from their
 * title, so they get a detail page. New records already get one when created.
 *
 * Only records with no slug are touched, and only their slug changes. Existing
 * URLs stay as they are, and running it again changes nothing.
 *
 * Usage:
 *   npm run backfill:slugs                # apply
 *   npm run backfill:slugs -- --dry-run   # preview only
 */
import "dotenv/config";
import type { Model } from "mongoose";
import mongoose from "mongoose";
import { connectDB } from "../../config/db";
import { Project } from "../../models/Project";
import { Service } from "../../models/Service";
import { slugify, uniqueSlug } from "../../utils/slug";

const MISSING = { $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }] };

async function backfill(
  label: string,
  model: Model<any>,
  dryRun: boolean,
): Promise<void> {
  const records = await model.find(MISSING).select("title").lean();
  const planned = new Set<string>();

  for (const record of records as unknown as { _id: mongoose.Types.ObjectId; title: string }[]) {
    if (dryRun) {
      // Nothing is saved yet, so names planned in this run must be counted too.
      const root = slugify(record.title) || "item";
      let slug = await uniqueSlug(model, root, record._id);
      for (let i = 2; planned.has(slug); i += 1) slug = `${root}-${i}`;
      planned.add(slug);
      console.log(`  would set ${label}: ${slug}`);
      continue;
    }

    const slug = await uniqueSlug(model, record.title, record._id);
    // The content did not change, so "last updated" should not either.
    await model.updateOne(
      { _id: record._id },
      { $set: { slug } },
      { timestamps: false },
    );
    console.log(`  set ${label}: ${slug}`);
  }

  console.log(`${label}: ${records.length} without a slug${dryRun ? " (dry run)" : " updated"}.`);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  await connectDB();
  await backfill("project", Project as unknown as Model<any>, dryRun);
  await backfill("service", Service as unknown as Model<any>, dryRun);
  await mongoose.disconnect();
}

main().catch((error: unknown) => {
  // Only the message: a driver error object can carry the connection string.
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Backfill failed: ${message.replace(/mongodb(\+srv)?:\/\/\S+/g, "<database>")}`);
  process.exit(1);
});
