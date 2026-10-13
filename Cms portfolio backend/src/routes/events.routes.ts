import { Request, Response, Router } from "express";
import { addClient, clientCount, removeClient, sendToClient } from "../lib/sse";

const router = Router();

/** Keep-alive beat, also stops proxies from closing an idle stream. */
const PING_INTERVAL_MS = 25_000;

/** Ask the browser to reconnect after 3s if the connection drops. */
const RETRY_MS = 3000;

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

  const client = addClient(res);
  sendToClient(client, "hello", {
    clients: clientCount(),
    at: Date.now(),
  });

  const ping = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      cleanup();
    }
  }, PING_INTERVAL_MS);

  function cleanup(): void {
    clearInterval(ping);
    removeClient(client.id);
  }

  req.on("close", cleanup);
  req.on("error", cleanup);
  res.on("close", cleanup);
  res.on("error", cleanup);
});

export default router;
