import "dotenv/config";
import mongoose from "mongoose";
import app, { ALLOWED_ORIGINS } from "./app";
import { connectDB } from "./config/db";
import { seedAdmin } from "./lib/seedAdmin";

const PORT = process.env.PORT ?? 5000;
/** Open SSE streams never finish on their own, so shutdown can't wait forever. */
const SHUTDOWN_GRACE_MS = 10_000;

async function start(): Promise<void> {
  await connectDB();
  await seedAdmin();

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`   CORS origins: ${ALLOWED_ORIGINS.join(", ")}`);
    console.log(`   SSE stream:   http://localhost:${PORT}/api/events`);
  });

  let stopping = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = true;
    console.log(`${signal} received, shutting down`);

    const force = setTimeout(() => server.closeAllConnections(), SHUTDOWN_GRACE_MS);
    force.unref();
    server.close(() => {
      mongoose.disconnect().finally(() => process.exit(0));
    });
    server.closeIdleConnections();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start().catch((error: unknown) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});
