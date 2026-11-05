import type { Request, Response } from "express";
import { handle } from "../lib/http";
import type { AuthenticatedRequest } from "../middleware/auth";
import * as auth from "../services/auth.service";

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
};
const cookieOptions = { ...cookieBase, maxAge: 7 * 24 * 60 * 60 * 1000 };

/**
 * Authentication responses must never be cached: a cached 200 could be replayed
 * to an anonymous visitor by a proxy or a CDN.
 */
function noStore(res: Response): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

const userId = (req: Request) => (req as AuthenticatedRequest).user!.id;

export const login = handle(async (req, res) => {
  noStore(res);
  const { token, user } = await auth.logIn(req.body);
  res.cookie("token", token, cookieOptions);
  res.status(200).json({
    success: true,
    message: "Login successful",
    email: user.email,
    role: user.role,
    user,
  });
});

export const changePassword = handle(async (req, res) => {
  noStore(res);
  const token = await auth.changePassword(userId(req), req.body ?? {});
  res.cookie("token", token, cookieOptions);
  res.status(200).json({ success: true, message: "Password changed." });
});

export const getMe = handle(async (req, res) => {
  noStore(res);
  res.status(200).json({ success: true, user: await auth.currentUser(userId(req)) });
});

export const logout = handle(async (req, res) => {
  noStore(res);
  await auth.revokeSessions(req.cookies?.token);
  res.clearCookie("token", cookieBase);
  res.status(200).json({ success: true, message: "Logged out successfully" });
});
