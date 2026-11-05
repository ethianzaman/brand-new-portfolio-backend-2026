import type { Request } from "express";
import { hiddenFailure, handle } from "../lib/http";
import type { AuthenticatedRequest } from "../middleware/auth";
import * as users from "../services/user.service";

/** The signed-in account. `protect` runs first on every route here. */
const actorOf = (req: Request) => (req as AuthenticatedRequest).user!;

export const getUsers = handle(async (req, res) => {
  res.status(200).json({ success: true, ...(await users.list(req.query.q)) });
}, hiddenFailure("Failed to load users."));

export const createUser = handle(async (req, res) => {
  const created = await users.create(actorOf(req), req.body);
  res.status(201).json({ success: true, message: "User created successfully.", ...created });
}, hiddenFailure("Failed to create user."));

export const resetUserPassword = handle(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    success: true,
    ...(await users.resetPassword(actorOf(req), req.params.id)),
  });
}, hiddenFailure("Failed to reset the password."));

export const updateUserRole = handle(async (req, res) => {
  const user = await users.changeRole(actorOf(req), req.params.id, req.body.role);
  res.status(200).json({ success: true, message: "Role updated successfully.", user });
}, hiddenFailure("Failed to update role."));

export const updateUserStatus = handle(async (req, res) => {
  const { isActive } = req.body;
  const user = await users.setActive(actorOf(req), req.params.id, isActive);
  res.status(200).json({
    success: true,
    message: isActive ? "Account enabled." : "Account disabled.",
    user,
  });
}, hiddenFailure("Failed to update account status."));

export const deleteUser = handle(async (req, res) => {
  const id = await users.remove(actorOf(req), req.params.id);
  res.status(200).json({ success: true, message: "User deleted.", id });
}, hiddenFailure("Failed to delete user."));
