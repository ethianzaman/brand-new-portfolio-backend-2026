import "dotenv/config";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "../../config/db";
import { Lead } from "../../models/Lead";
import { Message } from "../../models/Message";

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  One-off backfill: group existing contact-form messages by email into
 *  Leads and link every message to its person. Safe to re-run — it rebuilds
 *  each Lead's counters from the current messages.
 *
 *  Run:  npm run backfill:leads
 * ─────────────────────────────────────────────────────────────────────────
 */

function hashBody(email: string, body: string): string {
  return crypto
    .createHash("sha256")
    .update(`${email}\n${body}`)
    .digest("hex");
}

async function main(): Promise<void> {
  await connectDB();

  const messages = await Message.find().sort({ createdAt: 1 });
  console.log(`Found ${messages.length} message(s)`);

  const byEmail = new Map<string, typeof messages>();
  for (const m of messages) {
    const email = m.email.trim().toLowerCase();
    const list = byEmail.get(email) ?? [];
    list.push(m);
    byEmail.set(email, list);
  }

  let created = 0;
  let updated = 0;
  let linked = 0;

  for (const [email, list] of byEmail) {
    const first = list[0].createdAt;
    const last = list[list.length - 1].createdAt;
    const latestName = list[list.length - 1].name || list[0].name || "";
    const unreadCount = list.filter((m) => m.status === "unread").length;
    const replyCount = list.filter((m) => m.replied).length;

    const existing = await Lead.findOne({ email });

    const lead = await Lead.findOneAndUpdate(
      { email },
      {
        $set: {
          name: latestName,
          firstSeenAt: first,
          lastSeenAt: last,
          lastMessageAt: last,
          messageCount: list.length,
          unreadCount,
          replyCount,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    if (lead) {
      const result = await Message.updateMany(
        { email },
        { $set: { lead: lead._id } },
      );
      linked += result.modifiedCount;
    }

    if (existing) updated++;
    else created++;
  }

  // Backfill bodyHash so future window-dedupe works consistently.
  for (const m of messages) {
    if (!m.bodyHash) {
      await Message.updateOne(
        { _id: m._id },
        { $set: { bodyHash: hashBody(m.email.toLowerCase(), m.body) } },
      );
    }
  }

  console.log(
    `✅ Leads created: ${created}, updated: ${updated}, messages linked: ${linked}`,
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("❌ Backfill failed:", error);
  process.exit(1);
});
