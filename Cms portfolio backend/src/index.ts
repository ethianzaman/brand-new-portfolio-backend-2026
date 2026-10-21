import "dotenv/config";
import express from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import { User } from "./models/User";
import { connectDB } from "./config/db";
import { errorHandler } from "./middleware/errorHandler";

import authRoutes from "./routes/auth.routes";
import projectRoutes from "./routes/project.routes";
import skillRoutes from "./routes/skill.routes";
import serviceRoutes from "./routes/service.routes";
import aboutRoutes from "./routes/about.routes";
import contactRoutes from "./routes/contact.routes";
import messageRoutes from "./routes/message.routes";
import leadRoutes from "./routes/lead.routes";
import blogRoutes from "./routes/blog.routes";
import homeRoutes from "./routes/home.routes";
import settingsRoutes from "./routes/settings.routes";
import eventsRoutes from "./routes/events.routes";
import userRoutes from "./routes/user.routes";

const app = express();
const PORT = process.env.PORT ?? 5000;

/** Allowed browser origins, comma-separated for local + production. */
const ALLOWED_ORIGINS = (process.env.FRONTEND_URL ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    // No Origin header → curl / Postman / server-to-server. Allow it.
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
};

// ── Middleware ────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(
  compression({
    // The SSE stream MUST NOT be buffered, or no event ever reaches the
    // browser. The filter makes this independent of mount order.
    filter: (req, res) => {
      if (req.path.startsWith("/api/events")) return false;
      return compression.filter(req, res);
    },
  }),
);
app.use(express.json());
app.use(cookieParser());

// ── Routes ────────────────────────────────────────────────────────────
app.use("/api/events", eventsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/skills", skillRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/about", aboutRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/users", userRoutes);

// ── Health check ──────────────────────────────────────────────────────
app.get("/api/health", (_, res) => {
  res.json({ success: true, message: "API is running" });
});

// ── Error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ── Boot ──────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  await connectDB();
  await seedAdmin();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`   CORS origins: ${ALLOWED_ORIGINS.join(", ")}`);
    console.log(`   SSE stream:   http://localhost:${PORT}/api/events`);
  });
}

// ── Seed / bootstrap the first admin on start ────────────────────────
// One-time bootstrap: creates the ADMIN_EMAIL account with the admin role,
// or repairs that specific account (promote to active admin) if it already
// exists with a missing/invalid role. No other account is ever touched —
// other existing users keep their role and must be migrated explicitly
// (npm run migrate:roles).
async function seedAdmin(): Promise<void> {
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
    await User.create({ email, password, role: "admin", isActive: true });
    console.log("✅ Admin user seeded");
    return;
  }
  if (existing.role !== "admin" || existing.isActive !== true) {
    existing.role = "admin";
    existing.isActive = true;
    await existing.save();
    console.log(`✅ Bootstrap account ${email} promoted to active admin`);
  }
}

start().catch((error: unknown) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});
