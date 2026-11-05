import { Request, Response, Router } from "express";
import {
  addClient,
  clientCount,
  clientsFrom,
  lastContentChange,
  removeClient,
  sendToClient,
  type SseChannel,
} from "../lib/sse";
import {
  protect,
  requirePermission,
  type AuthenticatedRequest,
} from "../middleware/auth";

const router = Router();

/** Keep-alive beat, also stops proxies from closing an idle stream. */
const PING_INTERVAL_MS = 25_000;

/** Ask the browser to reconnect after 3s if the connection drops. */
const RETRY_MS = 3000;

/** Each stream holds a socket open, so both limits guard against running out. */
const MAX_CLIENTS = 2000;
const MAX_CLIENTS_PER_OWNER = 10;

/**
 * Access is only checked when a stream opens. Ending inbox streams regularly
 * makes the browser reconnect, so a removed permission or a disabled account
 * stops receiving messages within this time.
 */
const INBOX_STREAM_LIFETIME_MS = 5 * 60_000;

function openStream(
  req: Request,
  res: Response,
  channel: SseChannel,
  owner: string,
  lifetimeMs?: number,
): void {
  if (clientCount() >= MAX_CLIENTS || clientsFrom(owner) >= MAX_CLIENTS_PER_OWNER) {
    res.status(429).json({ success: false, message: "Too many connections." });
    return;
  }

  res.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Nginx / any reverse proxy in front of us must not buffer either.
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  // Tell the client how long to wait before reconnecting.
  res.write(`retry: ${RETRY_MS}\n\n`);

  const client = addClient(res, owner, channel);
  sendToClient(client, "hello", {
    at: Date.now(),
    lastContentAt: lastContentChange(),
  });

  const ping = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      cleanup();
    }
  }, PING_INTERVAL_MS);

  const expiry = lifetimeMs ? setTimeout(() => res.end(), lifetimeMs) : undefined;

  function cleanup(): void {
    clearInterval(ping);
    clearTimeout(expiry);
    removeClient(client.id);
  }

  req.on("close", cleanup);
  req.on("error", cleanup);
  res.on("close", cleanup);
  res.on("error", cleanup);
}

/**
 * GET /api/events — Server-Sent Events stream.
 *
 * Public: no auth. An open visitor tab listens here; `publishChange(tag)`
 * broadcasts a `content` event and the frontend calls `router.refresh()`.
 *
 * NOTE: mount with `app.use(...)` (not `app.get(path, router)` — a route
 * handler does not strip the mount prefix, so `router.get("/")` would 404),
 * and never let `compression()` wrap it.
 */
router.get("/", (req: Request, res: Response) => {
  openStream(req, res, "public", req.ip ?? "unknown");
});

/** GET /api/events/inbox — live contact messages for the dashboard. */
router.get(
  "/inbox",
  protect,
  requirePermission("messages.view"),
  (req: AuthenticatedRequest, res: Response) => {
    openStream(req, res, "inbox", `user:${req.user?.id}`, INBOX_STREAM_LIFETIME_MS);
  },
);

export default router;
