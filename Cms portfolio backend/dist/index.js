"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const User_1 = require("./models/User");
const db_1 = require("./config/db");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const project_routes_1 = __importDefault(require("./routes/project.routes"));
const skill_routes_1 = __importDefault(require("./routes/skill.routes"));
const service_routes_1 = __importDefault(require("./routes/service.routes"));
const about_routes_1 = __importDefault(require("./routes/about.routes"));
const contact_routes_1 = __importDefault(require("./routes/contact.routes"));
const message_routes_1 = __importDefault(require("./routes/message.routes"));
const lead_routes_1 = __importDefault(require("./routes/lead.routes"));
const blog_routes_1 = __importDefault(require("./routes/blog.routes"));
const home_routes_1 = __importDefault(require("./routes/home.routes"));
const settings_routes_1 = __importDefault(require("./routes/settings.routes"));
const events_routes_1 = __importDefault(require("./routes/events.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT ?? 5000;
/** Allowed browser origins, comma-separated for local + production. */
const ALLOWED_ORIGINS = (process.env.FRONTEND_URL ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const corsOptions = {
    origin(origin, callback) {
        // No Origin header → curl / Postman / server-to-server. Allow it.
        if (!origin)
            return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin))
            return callback(null, true);
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
};
// ── Middleware ────────────────────────────────────────────────────────
app.use((0, cors_1.default)(corsOptions));
app.use((0, compression_1.default)({
    // The SSE stream MUST NOT be buffered, or no event ever reaches the
    // browser. The filter makes this independent of mount order.
    filter: (req, res) => {
        if (req.path.startsWith("/api/events"))
            return false;
        return compression_1.default.filter(req, res);
    },
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
// ── Routes ────────────────────────────────────────────────────────────
app.use("/api/events", events_routes_1.default);
app.use("/api/auth", auth_routes_1.default);
app.use("/api/projects", project_routes_1.default);
app.use("/api/skills", skill_routes_1.default);
app.use("/api/services", service_routes_1.default);
app.use("/api/about", about_routes_1.default);
app.use("/api/contact", contact_routes_1.default);
app.use("/api/messages", message_routes_1.default);
app.use("/api/leads", lead_routes_1.default);
app.use("/api/blogs", blog_routes_1.default);
app.use("/api/home", home_routes_1.default);
app.use("/api/settings", settings_routes_1.default);
app.use("/api/users", user_routes_1.default);
// ── Health check ──────────────────────────────────────────────────────
app.get("/api/health", (_, res) => {
    res.json({ success: true, message: "API is running" });
});
// ── Error handler ─────────────────────────────────────────────────────
app.use(errorHandler_1.errorHandler);
// ── Boot ──────────────────────────────────────────────────────────────
async function start() {
    await (0, db_1.connectDB)();
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
async function seedAdmin() {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!email) {
        console.warn("⚠️  ADMIN_EMAIL is not set — skipping admin seed");
        return;
    }
    const password = process.env.ADMIN_PASSWORD;
    const existing = await User_1.User.findOne({ email });
    if (!existing) {
        if (!password) {
            console.warn("⚠️  ADMIN_EMAIL is set but ADMIN_PASSWORD is not — skipping admin seed");
            return;
        }
        await User_1.User.create({ email, password, role: "admin", isActive: true });
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
start().catch((error) => {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
});
