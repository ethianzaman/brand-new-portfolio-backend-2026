import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../config/env";
import { badRequest, HttpError } from "../lib/http";
import { permissionsForRole } from "../lib/permissions";
import { type IUser, User, USER_ROLES } from "../models/User";

// A real hash at the same cost, so a failed lookup takes as long as a failed password.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(randomUUID(), 12);

type Body = Record<string, any>;

const USER_GONE = () => new HttpError(401, "User no longer exists.");

function signToken(user: IUser): string {
  return jwt.sign({ id: user._id.toString(), v: user.tokenVersion ?? 0 }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export async function logIn({ email, password }: Body) {
  if (typeof email !== "string" || typeof password !== "string") {
    throw badRequest("Email and password are required.");
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+password");

  // Hash anyway, so response time does not reveal which emails exist.
  if (!user) await bcrypt.compare(password, DUMMY_PASSWORD_HASH);

  if (!user || !(await user.comparePassword(password))) {
    throw new HttpError(401, "Invalid email or password");
  }

  // Users with a missing or legacy role cannot sign in.
  if (!USER_ROLES.includes(user.role)) {
    throw new HttpError(
      403,
      "Your account does not have a valid role. Ask an administrator to assign one.",
    );
  }

  if (user.isActive === false) {
    throw new HttpError(403, "This account has been disabled. Contact the administrator.");
  }

  return {
    token: signToken(user),
    user: { id: user._id.toString(), email: user.email, role: user.role },
  };
}

/**
 * Every older token stops working, so a stolen session or another device is
 * signed out. The returned token keeps this device signed in.
 */
export async function changePassword(userId: string, { currentPassword, newPassword }: Body) {
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    throw badRequest("Current and new password are required.");
  }
  if (newPassword.length < 8 || newPassword.length > 128) {
    throw badRequest("New password must be 8-128 characters.");
  }
  if (newPassword === currentPassword) {
    throw badRequest("Choose a password different from the current one.");
  }

  const user = await User.findById(userId).select("+password");
  if (!user) throw USER_GONE();

  // 400, not 401: the session is fine, and a 401 means "signed out" to the app.
  if (!(await user.comparePassword(currentPassword))) {
    throw badRequest("Your current password is incorrect.");
  }

  user.password = newPassword;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  return signToken(user);
}

/** Read fresh, so the client always sees the current role and status. */
export async function currentUser(userId: string) {
  const user = await User.findById(userId).select("email role isActive createdAt");
  if (!user) throw USER_GONE();

  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    permissions: await permissionsForRole(user.role),
  };
}

/** Ends every session of the token's owner. A bad token has nothing to revoke. */
export async function revokeSessions(token: unknown) {
  try {
    const { id } = jwt.verify(token as string, JWT_SECRET) as { id?: unknown };
    if (typeof id === "string") {
      await User.updateOne({ _id: id }, { $inc: { tokenVersion: 1 } });
    }
  } catch {
    // No usable token.
  }
}
