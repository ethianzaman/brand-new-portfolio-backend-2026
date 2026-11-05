import { timingSafeEqual } from "crypto";
import type { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { AuthenticatedRequest } from "./auth";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * The visitor's IP. Login and the contact form reach this API through the
 * Next.js server, so `req.ip` would be the same address for everyone. That
 * server forwards the real one, and the header only counts alongside the shared
 * secret, otherwise anyone could dodge the limits by sending a made-up IP.
 */
export function clientIp(req: Request): string {
  const secret = process.env.REVALIDATE_SECRET?.trim();
  const sent = req.get("x-internal-secret");
  const forwarded = req.get("x-client-ip")?.trim();

  if (secret && sent && forwarded && sameSecret(secret, sent)) return forwarded;
  return req.ip ?? "unknown";
}

function ipKey(req: Request): string {
  return ipKeyGenerator(clientIp(req));
}

function limiter(options: {
  windowMs: number;
  limit: number;
  message: string;
  keyGenerator: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}) {
  const { message, ...rest } = options;

  return rateLimit({
    ...rest,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message },
  });
}

/** Stops one address trying many accounts. Only failed attempts count. */
export const loginIpLimiter = limiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 30,
  keyGenerator: ipKey,
  skipSuccessfulRequests: true,
  message: "Too many login attempts. Please try again in 15 minutes.",
});

/** Stops many addresses guessing one account. Only failed attempts count. */
export const loginAccountLimiter = limiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  keyGenerator: (req) => `account:${String(req.body?.email ?? "").trim().toLowerCase()}`,
  skipSuccessfulRequests: true,
  message: "Too many login attempts. Please try again in 15 minutes.",
});

/** Stops a stolen session guessing the current password. Only failed attempts count. */
export const changePasswordLimiter = limiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  keyGenerator: (req) => `password:${(req as AuthenticatedRequest).user?.id}`,
  skipSuccessfulRequests: true,
  message: "Too many attempts. Please try again in 15 minutes.",
});

/** Each accepted message sends an email, so this also protects the mailbox. */
export const contactLimiter = limiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  keyGenerator: ipKey,
  message: "Too many messages. Please try again a little later.",
});
