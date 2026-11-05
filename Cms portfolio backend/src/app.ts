import express from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { errorHandler } from "./middleware/errorHandler";
import { rejectMongoOperators } from "./middleware/sanitize";

import authRoutes from "./routes/auth.routes";
import projectRoutes from "./routes/project.routes";
import skillRoutes from "./routes/skill.routes";
import serviceRoutes from "./routes/service.routes";
import aboutRoutes from "./routes/about.routes";
import contactRoutes from "./routes/contact.routes";
import messageRoutes from "./routes/message.routes";
import leadRoutes from "./routes/lead.routes";
import blogRoutes from "./routes/blog.routes";
import heroRoutes from "./routes/hero.routes";
import settingsRoutes from "./routes/settings.routes";
import eventsRoutes from "./routes/events.routes";
import userRoutes from "./routes/user.routes";
import roleRoutes from "./routes/role.routes";

const app = express();

/** Allowed browser origins, comma-separated for local + production. */
export const ALLOWED_ORIGINS = (process.env.FRONTEND_URL ?? "http://localhost:3000")
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

// How many proxies sit in front of this server, so req.ip is the real client.
// Leave unset when nothing is in front of it: a wrong value lets clients fake it.
const trustedProxies = Number(process.env.TRUST_PROXY);
if (Number.isInteger(trustedProxies) && trustedProxies > 0) {
  app.set("trust proxy", trustedProxies);
}

// ── Middleware ────────────────────────────────────────────────────────
app.use(
  helmet({
    // The site reads this API from another origin (the SSE stream, for one).
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
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
app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());
app.use(rejectMongoOperators);

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
app.use("/api/hero", heroRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);

app.get("/api/health", (_, res) => {
  res.json({ success: true, message: "API is running" });
});

app.use(errorHandler);

export default app;
